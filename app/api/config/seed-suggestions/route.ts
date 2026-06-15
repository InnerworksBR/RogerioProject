import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { buildSeedSuggestionPlanForSupabase } from '@/lib/server/configSeed';
import { requireSameOrigin } from '@/lib/server/requestSecurity';

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { supabase, user, response } = await requireAuthenticatedRouteUser();

  if (response || !user) {
    return response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: 'preview' | 'apply';
  };
  const mode = body.mode ?? 'preview';

  const plan = await buildSeedSuggestionPlanForSupabase(supabase, user.id);

  if (mode !== 'apply') {
    return NextResponse.json(plan.response);
  }

  const insertedByReport = {
    base_itens: 0,
    bagagitos: 0,
    geral: 0,
  };

  for (const reportKey of ['base_itens', 'bagagitos', 'geral'] as const) {
    const rows = plan.insertsByReport[reportKey];

    if (rows.length === 0) {
      continue;
    }

    const { data, error } = await supabase
      .from('report_config_items')
      .insert(rows.map((row) => ({ ...row, user_id: user.id })))
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    insertedByReport[reportKey] = data?.length ?? 0;
  }

  const refreshedPlan = await buildSeedSuggestionPlanForSupabase(supabase, user.id);

  return NextResponse.json({
    ...refreshedPlan.response,
    applied: {
      insertedByReport,
    },
  });
}
