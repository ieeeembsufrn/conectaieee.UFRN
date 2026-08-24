import { supabase } from './supabase';

export interface ProfilePrivateData {
  profile_id?: number;
  phone?: string | null;
  cpf?: string[] | null;
  birth_date?: string | null;
  notes?: string | null;
}

const PRIVATE_PROFILE_COLUMNS = 'phone, cpf, birth_date, notes';

const normalizePrivateData = (profileId: number, data: any): ProfilePrivateData => ({
  profile_id: data?.profile_id ?? profileId,
  phone: data?.phone || '',
  cpf: Array.isArray(data?.cpf) ? data.cpf : [],
  birth_date: data?.birth_date || null,
  notes: data?.notes || ''
});

export const fetchProfilePrivateData = async (profileId: number) => {
  const { data, error } = await supabase
    .from('profile_private_data')
    .select(PRIVATE_PROFILE_COLUMNS)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (!error) {
    return normalizePrivateData(profileId, data);
  }

  throw error;
};

const toWritablePrivatePayload = (payload: ProfilePrivateData) => {
  const row: any = {};

  if ('phone' in payload) row.phone = payload.phone || null;
  if ('cpf' in payload) row.cpf = payload.cpf || [];
  if ('birth_date' in payload) row.birth_date = payload.birth_date || null;
  if ('notes' in payload) row.notes = payload.notes || null;

  return row;
};

export const saveProfilePrivateData = async (profileId: number, payload: ProfilePrivateData) => {
  const privatePayload = toWritablePrivatePayload(payload);
  const { error } = await supabase
    .from('profile_private_data')
    .upsert({ profile_id: profileId, ...privatePayload }, { onConflict: 'profile_id' });

  if (error) throw error;
};
