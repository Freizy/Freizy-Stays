function required(name: string, fallback = ""): string {
  const v = process.env[name] ?? fallback;
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  supabaseUrl: required("SUPABASE_URL"),
  // Accepts SUPABASE_KEY as alias (new sb_publishable_* keys work as the anon key)
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_KEY ?? "",
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  momo: {
    apiKey: required("MTN_MOMO_API_KEY"),
    userId: required("MTN_MOMO_USER_ID"),
    subscriptionKey: required("MTN_MOMO_SUBSCRIPTION_KEY"),
    environment: process.env.MTN_MOMO_ENVIRONMENT ?? "sandbox",
    callbackUrl: required("MTN_MOMO_CALLBACK_URL"),
  },
  paystackSecret: required("PAYSTACK_SECRET_KEY"),
  paystackCallbackUrl: required("PAYSTACK_CALLBACK_URL"),
};
