const DEFAULT_PUBLIC_APP_URL = 'https://unb.conectaieee.com';

export const getPublicAppUrl = () => {
  const configuredUrl =
    import.meta.env.VITE_PUBLIC_APP_URL ||
    import.meta.env.VITE_APP_URL ||
    '';

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  const { hostname, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  return isLocal ? DEFAULT_PUBLIC_APP_URL : origin;
};

export const getUpdatePasswordRedirectUrl = () => `${getPublicAppUrl()}/#/update-password`;

export const getAuthRecoveryRedirectUrl = () => getPublicAppUrl();
