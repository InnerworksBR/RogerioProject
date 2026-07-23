# Acessos: Recuperação e Troca de Senha

> **ID:** 014
> **Status:** 🟢 Concluída (pendência de config de ambiente — ver seção 9)
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-17
> **Última atualização:** 2026-06-17
> **Autor:** Agente AI

---

## 1. Resumo Executivo

O portal hoje só oferece login por email/senha (`signInWithPassword`) e logout. Não existe nenhum
fluxo de **recuperação de senha** ("esqueci minha senha"), de **redefinição via link** nem de
**troca de senha** para o usuário autenticado. Além disso, o convite de representantes
(`inviteUserByEmail`) aponta o `redirectTo` para `/login`, que **não processa o token** do convite —
ou seja, o representante convidado não tem uma tela onde defina a primeira senha. Esta implementação
entrega a base de autogestão de acesso: solicitar redefinição por email, redefinir/definir senha a
partir do link (recuperação **e** convite) via uma rota de callback que troca o `code` por sessão, e
trocar a senha estando logado. Tudo apoiado no Supabase Auth já em uso, **sem mudança de schema**.

## 2. Contexto e Motivação

### 2.1 Problema Atual

- `components/auth/LoginForm.tsx` só faz `supabase.auth.signInWithPassword`. O rodapé instrui o
  usuário a "solicitar a criação do usuário no Supabase Auth pelo administrador" e **não há link de
  "esqueci minha senha"**.
- Não existe rota para `resetPasswordForEmail`, nem página para concluir a redefinição
  (`updateUser({ password })`), nem rota de callback para `exchangeCodeForSession` (PKCE do
  `@supabase/ssr`).
- O convite de representante em `app/api/admin/reps/route.ts` usa
  `inviteUserByEmail(email, { redirectTo: \`${origin}/login\` })`. `/login` ignora o `code` do link,
  então o convidado cai numa tela de login sem nunca ter definido uma senha.
- `proxy.ts` (middleware) só libera `/login`, `/shared/client/*` e `/api/share/data`. Qualquer rota
  nova de recuperação precisa ser explicitamente liberada, senão o usuário sem sessão é redirecionado
  para `/login`.
- `components/auth/UserMenu.tsx` só tem "Sair"; não há ponto de entrada para a conta/segurança.

### 2.2 Impacto do Problema

- Usuário que esquece a senha fica **dependente de intervenção manual do administrador** no painel do
  Supabase, o que não escala e gera atrito.
- Representantes convidados **não conseguem ativar a conta** pelo fluxo atual (o link de convite não
  tem destino que processe o token), travando o onboarding desenhado na implementação 001/008.
- Não há como o próprio usuário **rotacionar a senha** após um vazamento suspeito, o que é uma lacuna
  de segurança básica.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Fluxo nativo do Supabase Auth (`resetPasswordForEmail` + `exchangeCodeForSession` + `updateUser`) | Reusa o stack já presente; sem schema novo; emails entregues pelo próprio Supabase | Depende da config de SMTP/redirect URLs do projeto Supabase | ✅ Escolhida |
| API própria com tokens de redefinição em tabela e envio de email custom | Controle total do template/expiração | Reimplementa o que o Auth já faz; superfície de ataque e manutenção maiores; precisa de provedor de email | ❌ Descartada |
| Manter redefinição apenas manual pelo admin | Zero código | Não atende ao pedido; não escala; trava onboarding | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

Fluxo de recuperação (esqueci a senha):

```
/login ──"Esqueci minha senha"──▶ /recuperar-senha
        (ForgotPasswordForm)  resetPasswordForEmail(email,
                              { redirectTo: <origin>/auth/callback?next=/redefinir-senha })
                                      │
                              [email do Supabase] ──clique──▶ /auth/callback?code=...&next=/redefinir-senha
                                      │ exchangeCodeForSession(code)  (cria sessão de recuperação)
                                      ▼
                                /redefinir-senha (ResetPasswordForm) ── updateUser({ password }) ──▶ /
```

Fluxo de convite (reaproveita a mesma rota de callback e página):

```
Líder convida ─ inviteUserByEmail(redirectTo=<origin>/auth/callback?next=/redefinir-senha)
            ─ email ─ clique ─▶ /auth/callback ─ exchange ─▶ /redefinir-senha (define 1ª senha)
```

Fluxo de troca (logado): `UserMenu` → `/conta` (`ChangePasswordForm`) → reautentica com a senha atual
(`signInWithPassword`) e então `updateUser({ password })`.

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `lib/passwordPolicy.ts` | Arquivo | Criar | Validação compartilhada de senha (mín. 8, etc.) e mensagens pt-BR. |
| `app/auth/callback/route.ts` | Arquivo | Criar | Route handler que faz `exchangeCodeForSession` e redireciona para `next` (sanitizado). |
| `app/recuperar-senha/page.tsx` | Arquivo | Criar | Página pública com `ForgotPasswordForm`. |
| `components/auth/ForgotPasswordForm.tsx` | Arquivo | Criar | Form que chama `resetPasswordForEmail` e mostra confirmação neutra. |
| `app/redefinir-senha/page.tsx` | Arquivo | Criar | Página para definir nova senha (recuperação ou convite). |
| `components/auth/ResetPasswordForm.tsx` | Arquivo | Criar | Form que valida e chama `updateUser({ password })`. |
| `app/(protected)/conta/page.tsx` | Arquivo | Criar | Página protegida de conta/segurança. |
| `components/auth/ChangePasswordForm.tsx` | Arquivo | Criar | Form de troca: reautentica com senha atual e atualiza. |
| `components/auth/LoginForm.tsx` | Arquivo | Modificar | Adicionar link "Esqueci minha senha" → `/recuperar-senha`. |
| `components/auth/UserMenu.tsx` | Arquivo | Modificar | Adicionar acesso a `/conta`. |
| `proxy.ts` | Arquivo | Modificar | Liberar `/recuperar-senha`, `/redefinir-senha` e `/auth/callback` como rotas públicas. |
| `app/api/admin/reps/route.ts` | Arquivo | Modificar | `redirectTo` do convite → `/auth/callback?next=/redefinir-senha`. |
| `tests/access-recovery.test.mjs` | Arquivo | Criar | Regressão de rotas públicas, proteção de `/conta` e existência das telas. |

### 3.3 Interfaces e Contratos

#### Entradas

- **Recuperação:** `{ email: string }` (campo do `ForgotPasswordForm`).
- **Redefinição/convite:** `{ password: string, confirmPassword: string }` + sessão de recuperação
  estabelecida pelo callback. Query do callback: `code` (PKCE) e `next` (caminho interno).
- **Troca (logado):** `{ currentPassword: string, newPassword: string, confirmPassword: string }`.

#### Saídas

- **Recuperação:** sempre mensagem neutra de sucesso ("Se o email existir, enviamos um link…"),
  independentemente de o email existir (anti-enumeração).
- **Redefinição/troca:** sucesso (toast + redirecionamento) ou erro de validação/Auth exibido inline.
- **Callback:** `302/redirect` para `next` (validado) em sucesso; redireciona para
  `/login?error=...` em código inválido/expirado.

#### Contratos de API (se aplicável)

- `GET /auth/callback?code=<string>&next=<path>` → troca o código por sessão (cookies httpOnly via
  `@supabase/ssr`) e redireciona. `next` deve começar com `/` e não ser protocolo-relativo (`//`),
  senão usa `/` (mesma política de `normalizeRedirectPath` já existente no projeto).

### 3.4 Modelos de Dados (se aplicável)

N/A — o Supabase Auth gerencia credenciais e tokens de recuperação. **Nenhuma migration nova**;
a tabela `profiles` e as roles (`leader`/`rep`) permanecem inalteradas.

### 3.5 Fluxo de Execução

1. Usuário sem senha clica em "Esqueci minha senha" no login → `/recuperar-senha`.
2. Informa o email; o front chama `resetPasswordForEmail(email, { redirectTo })` e exibe confirmação
   neutra.
3. Usuário abre o email e clica no link → `/auth/callback?code=…&next=/redefinir-senha`.
4. O route handler troca o `code` por sessão e redireciona para `/redefinir-senha`.
5. Em `/redefinir-senha`, o usuário define a nova senha (validada localmente) → `updateUser`.
6. Em sucesso, redireciona para `/` (já autenticado). Em falha (link expirado/sem sessão), orienta a
   solicitar novo link.
7. Para troca logado: `UserMenu` → `/conta` → informa senha atual + nova; o front reautentica com
   `signInWithPassword(email, currentPassword)` e, se ok, chama `updateUser({ password })`.

### 3.6 Tratamento de Erros

- **Email inválido / vazio:** validação inline antes da chamada.
- **`resetPasswordForEmail` falhou:** mensagem genérica de sucesso mesmo assim (anti-enumeração);
  erros de rede tratados com toast genérico.
- **Callback com `code` ausente/expirado:** redirecionar para `/login?error=link_invalido` com aviso.
- **`/redefinir-senha` sem sessão de recuperação:** exibir estado explicativo com botão para
  solicitar novo link em `/recuperar-senha`.
- **Senha fraca / confirmação divergente:** validação local com mensagens da `passwordPolicy`.
- **Troca com senha atual incorreta:** a reautenticação falha → mensagem "Senha atual incorreta",
  sem chamar `updateUser`.
- **Sessão expira durante a troca:** erro do Auth tratado com toast e sugestão de relogar.

## 4. Requisitos

### 4.1 Requisitos Funcionais

- **RF-001:** Na tela de login deve existir um link "Esqueci minha senha" que leva a
  `/recuperar-senha`.
- **RF-002:** Em `/recuperar-senha`, o usuário informa o email e dispara o envio do link de
  redefinição via `resetPasswordForEmail`.
- **RF-003:** A resposta da solicitação de recuperação deve ser neutra (não revelar se o email
  existe).
- **RF-004:** `/auth/callback` deve trocar o `code` por sessão e redirecionar para o `next` interno
  sanitizado.
- **RF-005:** Em `/redefinir-senha`, o usuário com sessão de recuperação define a nova senha
  (com confirmação) e é redirecionado autenticado.
- **RF-006:** O mesmo fluxo (`/auth/callback` → `/redefinir-senha`) deve atender ao **convite** de
  representantes, permitindo definir a primeira senha.
- **RF-007:** Em `/conta`, o usuário autenticado troca a senha informando a senha atual e a nova.
- **RF-008:** A troca só ocorre após reautenticação bem-sucedida com a senha atual.
- **RF-009:** `UserMenu` deve oferecer acesso a `/conta`.

### 4.2 Requisitos Não-Funcionais

- **RNF-001:** As rotas `/recuperar-senha`, `/redefinir-senha` e `/auth/callback` devem ser públicas
  no middleware (`proxy.ts`); as demais permanecem protegidas.
- **RNF-002:** Política mínima de senha compartilhada (mín. 8 caracteres) aplicada em redefinição,
  convite e troca, com mensagens em pt-BR.
- **RNF-003:** `next` do callback deve ser validado contra open-redirect (apenas caminhos internos
  iniciados por `/`, exceto `//`).
- **RNF-004:** Visual consistente com o `glass-card`/gradiente já usados no login e demais telas.
- **RNF-005:** Acessibilidade: labels associadas, foco visível e estados de carregamento/erro claros,
  alinhados à implementação 010.

### 4.3 Restrições e Limitações

- Depende da configuração no painel Supabase: provedor de SMTP/email e **Redirect URLs** permitindo
  `<origin>/auth/callback`. Isso é configuração de ambiente, fora do código.
- Não cobre 2FA/MFA, troca de email, nem políticas de expiração/rotação obrigatória de senha — ficam
  fora do escopo desta entrega.

## 5. Critérios de Aceitação

- [ ] **CA-001:** A tela de login mostra "Esqueci minha senha" que abre `/recuperar-senha`.
- [ ] **CA-002:** Enviar o email em `/recuperar-senha` dispara `resetPasswordForEmail` e exibe
  confirmação neutra, sem revelar existência do email.
- [ ] **CA-003:** Clicar no link do email passa por `/auth/callback` e chega autenticado em
  `/redefinir-senha`.
- [ ] **CA-004:** Definir nova senha válida em `/redefinir-senha` atualiza a senha e leva ao painel.
- [ ] **CA-005:** Um representante convidado consegue definir a primeira senha pelo mesmo fluxo.
- [ ] **CA-006:** Em `/conta`, com a senha atual correta, a troca atualiza a senha; com a senha atual
  incorreta, a operação é bloqueada com mensagem clara.
- [ ] **CA-007:** Senhas fracas ou confirmação divergente são rejeitadas localmente nas três telas.
- [ ] **CA-008:** Sem sessão, `/conta` redireciona para `/login`; `/recuperar-senha`,
  `/redefinir-senha` e `/auth/callback` são acessíveis sem sessão.
- [ ] **CA-009:** `npm test`, `npm run typecheck` e `npm run build` passam.

## 6. Plano de Testes

### 6.1 Testes Unitários

- `lib/passwordPolicy.ts`: aceita senha válida, rejeita curta/ vazia, detecta confirmação divergente.
- `normalizeNext` do callback: rejeita `//evil.com`, `http://…`, aceita `/redefinir-senha`.

### 6.2 Testes de Integração

- Middleware: `/recuperar-senha`, `/redefinir-senha`, `/auth/callback` respondem sem redirecionar
  para login; `/conta` sem sessão responde `307` para `/login?redirectedFrom=%2Fconta`.

### 6.3 Testes de Aceitação

- Verificação manual/HTTP dos fluxos descritos nos critérios de aceitação (envio de email depende do
  SMTP configurado no Supabase; quando indisponível, validar redirecionamentos e estados de UI).

### 6.4 Casos de Borda (Edge Cases)

- `/auth/callback` sem `code` ou com `code` expirado → `/login?error=link_invalido`.
- `/redefinir-senha` acessada diretamente sem sessão de recuperação → estado explicativo.
- `next` malicioso (`//`, `http://`) ignorado.
- Troca com senha atual correta porém nova igual à antiga → mensagem adequada (erro do Auth ou
  validação local).
- Reenvio de recuperação várias vezes → comportamento idempotente, sem vazar enumeração.

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Redirect URL do `/auth/callback` não liberada no Supabase | Média | Alto | Documentar no `tasks.md`/checklist; validar em staging antes do deploy |
| SMTP não configurado impede entrega do email | Média | Alto | Sinalizar dependência de ambiente; tela funciona, mas email depende de config |
| Open-redirect via `next` | Baixa | Alto | Sanitizar `next` reaproveitando a política de redirect já existente |
| Enumeração de emails | Baixa | Médio | Resposta neutra padronizada em `/recuperar-senha` |
| Convite quebrado por divergência de `redirectTo` | Baixa | Médio | Alinhar `redirectTo` do convite ao mesmo `/auth/callback` e cobrir por teste |

## 8. Dependências

### 8.1 Dependências Internas

- `lib/supabase.ts` / `lib/supabaseServer.ts` (clientes Auth já existentes).
- `proxy.ts` (lista de rotas públicas).
- `app/api/admin/reps/route.ts` (fluxo de convite — implementações 001/008).
- Componentes de UI (`Input`, `Button`, etc.) e padrão visual `glass-card`.

### 8.2 Dependências Externas

- Supabase Auth (`resetPasswordForEmail`, `exchangeCodeForSession`, `updateUser`,
  `signInWithPassword`).
- Configuração de SMTP e **Redirect URLs** no projeto Supabase (ambiente).

## 9. Observações e Decisões de Design

- **Reuso do callback para convite e recuperação:** ambos os fluxos do Supabase entregam um `code`
  PKCE; uma única rota `/auth/callback` cobre os dois, reduzindo superfície e duplicação.
- **Reautenticação na troca logado:** o Supabase `updateUser({ password })` não exige a senha atual.
  Para evitar que uma sessão sequestrada troque a senha sem conhecê-la, reautenticamos via
  `signInWithPassword` antes de atualizar.
- **Sem schema novo:** mantém a entrega pequena e reversível; toda a lógica de token fica no Auth.
- **Idiomas/URLs em pt-BR** (`/recuperar-senha`, `/redefinir-senha`, `/conta`) para consistência com
  o restante do produto; `/auth/callback` mantém o termo técnico por ser rota de máquina.

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.
