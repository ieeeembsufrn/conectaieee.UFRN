export const getProfileChapters = (profile: any) => {
  return profile?.profile_chapters || profile?.profileChapters || [];
};

export const hasExternalPermission = (profile: any) => {
  return getProfileChapters(profile).some((pc: any) => pc.permission_slug === 'external');
};

export const isExternalOnlyProfile = (profile: any) => {
  const chapters = getProfileChapters(profile);
  const hasExternal = chapters.some((pc: any) => pc.permission_slug === 'external');
  const hasInternalRole = chapters.some((pc: any) =>
    ['admin', 'chair', 'manager', 'member'].includes(pc.permission_slug)
  );

  return hasExternal && !hasInternalRole;
};
