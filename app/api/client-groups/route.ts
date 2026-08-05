import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { requireSameOrigin } from '@/lib/server/requestSecurity';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getRole(
  supabase: Awaited<ReturnType<typeof requireAuthenticatedRouteUser>>['supabase'],
  userId: string
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data?.role as 'leader' | 'rep';
}

export async function GET() {
  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) {
    return response ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const [role, groupsResult, clientsResult] = await Promise.all([
      getRole(supabase, user.id),
      supabase
        .from('client_groups')
        .select('id,name,updated_at,client_group_members(id,cod_cliente,nome_cliente)')
        .order('name'),
      supabase.rpc('search_raw_clients', { p_query: '', p_limit: 1000 }),
    ]);
    if (groupsResult.error) throw groupsResult.error;
    if (clientsResult.error) throw clientsResult.error;

    return NextResponse.json({
      canManage: role === 'leader',
      groups: groupsResult.data ?? [],
      clients: clientsResult.data ?? [],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[client-groups.get]', error);
    return NextResponse.json({ error: 'Não foi possível carregar os grupos de clientes.' }, { status: 500 });
  }
}

async function saveGroup(request: NextRequest, groupId: string | null) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) {
    return response ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const role = await getRole(supabase, user.id);
    if (role !== 'leader') {
      return NextResponse.json({ error: 'Somente o líder pode alterar grupos.' }, { status: 403 });
    }
    if (groupId && !UUID_PATTERN.test(groupId)) {
      return NextResponse.json({ error: 'Grupo inválido.' }, { status: 400 });
    }
    const body = await request.json() as { name?: unknown; codes?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const codes = Array.isArray(body.codes)
      ? Array.from(new Set(body.codes.filter((code): code is string => typeof code === 'string').map((code) => code.trim()).filter(Boolean)))
      : [];
    if (name.length < 2 || name.length > 120 || codes.length < 2 || codes.length > 100) {
      return NextResponse.json({ error: 'Informe um nome e de 2 a 100 clientes.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('save_client_group', {
      p_group_id: groupId,
      p_name: name,
      p_codes: codes,
    });
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Um dos clientes já pertence a outro grupo.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ id: data }, { status: groupId ? 200 : 201 });
  } catch (error) {
    console.error('[client-groups.save]', error);
    return NextResponse.json({ error: 'Não foi possível salvar o grupo.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return saveGroup(request, null);
}

export async function PATCH(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get('id');
  if (!groupId) return NextResponse.json({ error: 'Grupo não informado.' }, { status: 400 });
  return saveGroup(request, groupId);
}

export async function DELETE(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) {
    return response ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const groupId = request.nextUrl.searchParams.get('id');
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return NextResponse.json({ error: 'Grupo inválido.' }, { status: 400 });
  }

  try {
    const role = await getRole(supabase, user.id);
    if (role !== 'leader') {
      return NextResponse.json({ error: 'Somente o líder pode excluir grupos.' }, { status: 403 });
    }
    const { data: deleted, error } = await supabase.rpc('delete_client_group', {
      p_group_id: groupId,
    });
    if (error) throw error;
    if (!deleted) {
      return NextResponse.json({ error: 'Grupo não encontrado.' }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[client-groups.delete]', error);
    return NextResponse.json({ error: 'Não foi possível excluir o grupo.' }, { status: 500 });
  }
}
