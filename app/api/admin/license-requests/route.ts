import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { getAdminSupabaseClient } from '@/lib/server/adminSupabase';
import { requireSameOrigin } from '@/lib/server/requestSecurity';

const VALID_PLANS = new Set(['plan_1', 'plan_2', 'plan_3']);
const MAX_NOTES_LENGTH = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireLeader() {
  const supabaseAdmin = getAdminSupabaseClient();
  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) {
    return { error: response || NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || profile?.role !== 'leader') {
    return { error: NextResponse.json({ error: 'Only leaders can request licenses' }, { status: 403 }) };
  }

  return { supabaseAdmin, user };
}

export async function GET() {
  try {
    const context = await requireLeader();
    if (context.error) return context.error;
    const { supabaseAdmin, user } = context;

    const { data, error } = await supabaseAdmin
      .from('license_requests')
      .select('id, plan, quantity, status, notes, created_at, updated_at')
      .eq('leader_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    console.error('Error fetching license requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const context = await requireLeader();
    if (context.error) return context.error;
    const { supabaseAdmin, user } = context;
    const body = (await req.json().catch(() => ({}))) as {
      plan?: unknown;
      quantity?: unknown;
      notes?: unknown;
    };

    if (typeof body.plan !== 'string' || !VALID_PLANS.has(body.plan)) {
      return NextResponse.json({ error: 'A valid plan is required' }, { status: 400 });
    }

    if (!Number.isInteger(body.quantity) || (body.quantity as number) <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive integer' }, { status: 400 });
    }

    if (body.notes !== undefined && typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'Notes must be text' }, { status: 400 });
    }

    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    if (notes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json({ error: `Notes must contain at most ${MAX_NOTES_LENGTH} characters` }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('license_requests')
      .insert({
        leader_id: user.id,
        plan: body.plan,
        quantity: body.quantity as number,
        notes: notes || null,
      })
      .select('id, plan, quantity, status, notes, created_at, updated_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ request: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating license request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const context = await requireLeader();
    if (context.error) return context.error;
    const { supabaseAdmin, user } = context;
    const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };

    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'License request is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('license_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('leader_id', user.id)
      .eq('status', 'pending')
      .select('id, plan, quantity, status, notes, created_at, updated_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Pending license request not found' }, { status: 404 });
    }

    return NextResponse.json({ request: data });
  } catch (error) {
    console.error('Error cancelling license request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
