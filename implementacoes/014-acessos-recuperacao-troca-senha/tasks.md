# Tarefas: Acessos — Recuperação e Troca de Senha

> **Implementação:** 014 - Acessos: Recuperação e Troca de Senha
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 10/10 tarefas concluídas (100%)
> **Última atualização:** 2026-06-17

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada (ver observação)
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Base e Infra

- [x] **T-001:** Criar `lib/passwordPolicy.ts` com validação de senha compartilhada.
  - **Descrição:** Função pura que valida senha mínima (≥ 8 caracteres) e confirmação, retornando mensagens em pt-BR reutilizáveis nas três telas.
  - **Arquivos envolvidos:** `lib/passwordPolicy.ts`
  - **Critério de conclusão:** Função exportada e tipada, sem dependência de React/DOM.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-002:** Criar a rota `app/auth/callback/route.ts`.
  - **Descrição:** Route handler `GET` que faz `exchangeCodeForSession(code)` e redireciona para o `next` sanitizado (apenas caminhos internos `/`, exceto `//`); em código ausente/expirado redireciona para `/login?error=link_invalido`.
  - **Arquivos envolvidos:** `app/auth/callback/route.ts`, `lib/supabaseServer.ts`
  - **Critério de conclusão:** Troca o código por sessão e aplica a sanitização de `next`.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-003:** Liberar as rotas públicas no middleware `proxy.ts`.
  - **Descrição:** Adicionar `/recuperar-senha`, `/redefinir-senha` e `/auth/callback` à lista de rotas públicas, mantendo todas as demais protegidas.
  - **Arquivos envolvidos:** `proxy.ts`
  - **Critério de conclusão:** As três rotas respondem sem redirecionar para `/login`; `/conta` continua protegida.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 2: Recuperação e Redefinição

- [x] **T-004:** Criar a tela de recuperação (`/recuperar-senha`).
  - **Descrição:** `app/recuperar-senha/page.tsx` + `components/auth/ForgotPasswordForm.tsx` chamando `resetPasswordForEmail(email, { redirectTo: <origin>/auth/callback?next=/redefinir-senha })` com confirmação neutra (anti-enumeração).
  - **Arquivos envolvidos:** `app/recuperar-senha/page.tsx`, `components/auth/ForgotPasswordForm.tsx`
  - **Critério de conclusão:** Envia o link e exibe mensagem neutra de sucesso; visual `glass-card`.
  - **Dependências:** T-001
  - **Estimativa:** Média
  - **Observações:** *(Pode ser feito em paralelo com a T-005 usando subagente.)*

- [x] **T-005:** Criar a tela de redefinição/definição de senha (`/redefinir-senha`).
  - **Descrição:** `app/redefinir-senha/page.tsx` + `components/auth/ResetPasswordForm.tsx` que valida (via `passwordPolicy`) e chama `updateUser({ password })`; trata ausência de sessão de recuperação com estado explicativo e link para `/recuperar-senha`.
  - **Arquivos envolvidos:** `app/redefinir-senha/page.tsx`, `components/auth/ResetPasswordForm.tsx`
  - **Critério de conclusão:** Define a senha e redireciona autenticado; trata link expirado/sem sessão.
  - **Dependências:** T-001
  - **Estimativa:** Média
  - **Observações:** *(Pode ser feito em paralelo com a T-004 usando subagente.)*

- [x] **T-006:** Adicionar o link "Esqueci minha senha" no `LoginForm`.
  - **Descrição:** Incluir link para `/recuperar-senha` no `components/auth/LoginForm.tsx`, mantendo o layout atual.
  - **Arquivos envolvidos:** `components/auth/LoginForm.tsx`
  - **Critério de conclusão:** Link visível e funcional na tela de login.
  - **Dependências:** T-004
  - **Estimativa:** Pequena

### Fase 3: Convite e Troca Logado

- [x] **T-007:** Apontar o convite de representantes para o callback.
  - **Descrição:** Ajustar `redirectTo` em `app/api/admin/reps/route.ts` de `/login` para `/auth/callback?next=/redefinir-senha`, permitindo que o convidado defina a primeira senha pelo mesmo fluxo.
  - **Arquivos envolvidos:** `app/api/admin/reps/route.ts`
  - **Critério de conclusão:** Novo convite leva o usuário a definir senha em `/redefinir-senha`.
  - **Dependências:** T-002, T-005
  - **Estimativa:** Pequena

- [x] **T-008:** Criar a página de conta e troca de senha (`/conta`).
  - **Descrição:** `app/(protected)/conta/page.tsx` + `components/auth/ChangePasswordForm.tsx` que reautentica com a senha atual (`signInWithPassword`) e, em sucesso, chama `updateUser({ password })`. Adicionar acesso a `/conta` no `UserMenu`.
  - **Arquivos envolvidos:** `app/(protected)/conta/page.tsx`, `components/auth/ChangePasswordForm.tsx`, `components/auth/UserMenu.tsx`
  - **Critério de conclusão:** Troca funciona com senha atual correta e é bloqueada com senha atual incorreta; link visível no menu.
  - **Dependências:** T-001
  - **Estimativa:** Média

### Fase 4: Testes e Validação

- [x] **T-009:** Adicionar testes de regressão.
  - **Descrição:** `tests/access-recovery.test.mjs` cobrindo: rotas públicas acessíveis sem sessão, `/conta` redirecionando para `/login` sem sessão, sanitização de `next` e validação de `passwordPolicy`.
  - **Arquivos envolvidos:** `tests/access-recovery.test.mjs`
  - **Critério de conclusão:** Testes passam e cobrem os casos da spec (seção 6).
  - **Dependências:** T-002, T-003, T-008
  - **Estimativa:** Média

- [x] **T-010:** Executar `npm test`, `npm run typecheck` e `npm run build`; registrar resultado.
  - **Descrição:** Rodar a suíte completa, corrigir problemas e atualizar este checklist + o status no `spec.md` e no `README.md` das implementações.
  - **Arquivos envolvidos:** `implementacoes/014-acessos-recuperacao-troca-senha/*`, `implementacoes/README.md`
  - **Critério de conclusão:** Os três comandos passam; documentação atualizada.
  - **Dependências:** T-001..T-009
  - **Estimativa:** Pequena
  - **Observações:** A entrega de email depende de SMTP + Redirect URLs configurados no Supabase (config de ambiente, fora do código).

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | ✅ Concluída | 2026-06-17 | — |
| T-002  | ✅ Concluída | 2026-06-17 | — |
| T-003  | ✅ Concluída | 2026-06-17 | — |
| T-004  | ✅ Concluída | 2026-06-17 | — |
| T-005  | ✅ Concluída | 2026-06-17 | — |
| T-006  | ✅ Concluída | 2026-06-17 | — |
| T-007  | ✅ Concluída | 2026-06-17 | — |
| T-008  | ✅ Concluída | 2026-06-17 | — |
| T-009  | ✅ Concluída | 2026-06-17 | — |
| T-010  | ✅ Concluída | 2026-06-17 | — |

---

## Resultado Final

- `lib/passwordPolicy.ts` criado (validação de senha + `normalizeInternalPath` anti open-redirect).
- Rota `app/auth/callback/route.ts` criada: `exchangeCodeForSession` + redirect sanitizado; cobre recuperação **e** convite.
- `proxy.ts` libera `/recuperar-senha`, `/redefinir-senha` e `/auth/callback`; demais rotas seguem protegidas.
- Telas criadas: `/recuperar-senha` (`ForgotPasswordForm`, resposta neutra) e `/redefinir-senha` (`ResetPasswordForm`, valida sessão de recuperação).
- `LoginForm` ganhou o link "Esqueci minha senha".
- Convite de representantes (`app/api/admin/reps/route.ts`) agora aponta para `/auth/callback?next=/redefinir-senha`, destravando o onboarding.
- `/conta` (protegida) + `ChangePasswordForm` com reautenticação pela senha atual antes de `updateUser`; acesso adicionado ao `UserMenu`.
- `tests/access-recovery.test.mjs` adicionado (9 testes).
- `npm test` (40/40), `npm run typecheck` e `npm run build` executados com sucesso; rotas `/auth/callback`, `/conta`, `/recuperar-senha` (estática), `/redefinir-senha` (estática) presentes no output do build.
- **Pendência de ambiente (fora do código):** habilitar SMTP no projeto Supabase e incluir `<origin>/auth/callback` nas *Redirect URLs* permitidas, senão o email de recuperação/convite não é entregue.

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.
