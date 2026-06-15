import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRouteUser } from '@/lib/auth';
import { getAdminSupabaseClient } from '@/lib/server/adminSupabase';
import { requireSameOrigin } from '@/lib/server/requestSecurity';

function isAuthUserNotFound(error: { status?: number; message?: string } | null) {
  return error?.status === 404 || /user not found/i.test(error?.message ?? '');
}

async function requireLeader() {
  const supabaseAdmin = getAdminSupabaseClient();
  const { supabase, user, response } = await requireAuthenticatedRouteUser();
  if (response || !user) {
    return { error: response || NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, license_count')
    .eq('id', user.id)
    .single();

  if (error || profile?.role !== 'leader') {
    return { error: NextResponse.json({ error: 'Only leaders can manage representatives' }, { status: 403 }) };
  }

  return { supabase, supabaseAdmin, user, profile };
}

export async function POST(req: NextRequest) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const context = await requireLeader();
    if (context.error) return context.error;
    const { supabaseAdmin, user, profile } = context;

    const { email, name } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    // Check license limits
    const { count, error: countError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('leader_id', user.id)
      .eq('is_active', true);

    if (countError) throw countError;

    if (count !== null && count >= profile.license_count) {
      return NextResponse.json(
        { error: `License limit reached. You can only manage up to ${profile.license_count} representatives.` },
        { status: 402 }
      );
    }

    // Invite the representative so they define their own password.
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${req.nextUrl.origin}/login`,
      data: { name },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // Insert into profiles
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        role: 'rep',
        leader_id: user.id,
        license_count: 0
      });

    if (profileInsertError) {
      // Rollback user creation
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: profileInsertError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        name,
        invited: true,
      }
    });

  } catch (error) {
    console.error('Error creating representative:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireLeader();
    if (context.error) return context.error;
    const { supabaseAdmin, user } = context;

    // We fetch reps from 'profiles' and enrich with auth data using Service Role
    const { data: reps } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('leader_id', user.id);

    if (!reps) return NextResponse.json({ reps: [] });

    // Fetch only the Auth users that belong to this leader.
    const authUsers = await Promise.all(
      reps.map(async (rep) => {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(rep.id);
        if (error && !isAuthUserNotFound(error)) throw error;
        return data.user;
      })
    );

    const repsById = new Map(reps.map(rep => [rep.id, rep]));
    const repProfiles = authUsers
      .filter(user => user !== null)
      .map(u => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || 'Sem nome',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        is_active: repsById.get(u.id)?.is_active ?? true,
      }));

    return NextResponse.json({ reps: repProfiles });

  } catch (error) {
    console.error('Error fetching representatives:', error);
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
    const { id, isActive } = (await req.json().catch(() => ({}))) as { id?: string; isActive?: boolean };
    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Representative and status are required' }, { status: 400 });
    }

    const { data: rep } = await supabaseAdmin.from('profiles').select('id').eq('id', id).eq('leader_id', user.id).single();
    if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: isActive ? 'none' : '876000h',
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const { error } = await supabaseAdmin.from('profiles').update({ is_active: isActive }).eq('id', id).eq('leader_id', user.id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating representative:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const context = await requireLeader();
    if (context.error) return context.error;
    const { supabase, supabaseAdmin, user } = context;
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return NextResponse.json({ error: 'Representative is required' }, { status: 400 });

    const { data: rep } = await supabaseAdmin.from('profiles').select('id').eq('id', id).eq('leader_id', user.id).single();
    if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

    const { error: blockError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: '876000h',
    });
    if (blockError && !isAuthUserNotFound(blockError)) {
      return NextResponse.json({ error: blockError.message }, { status: 500 });
    }

    const { error: offboardingError } = await supabase.rpc('offboard_representative', { p_rep_id: id });
    if (offboardingError) throw offboardingError;

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    return authError && !isAuthUserNotFound(authError)
      ? NextResponse.json({ error: authError.message }, { status: 500 })
      : NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting representative:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
