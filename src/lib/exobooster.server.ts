// Server-only ExoBooster API client
const API_URL = () => process.env.EXOBOOSTER_API_URL || "https://exosupplier.com/api/v2";
const API_KEY = () => process.env.EXOBOOSTER_API_KEY || "";

type ProviderService = {
  service: string | number;
  name: string;
  category?: string;
  type?: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  description?: string;
  average_time?: string;
  avg_time?: string;
  refill?: boolean;
  cancel?: boolean;
  dripfeed?: boolean;
};

async function call(params: Record<string, string>): Promise<unknown> {
  const body = new URLSearchParams({ key: API_KEY(), ...params });
  const res = await fetch(API_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`ExoBooster non-JSON response: ${text.slice(0, 200)}`);
  }
}

export async function fetchServices(): Promise<ProviderService[]> {
  const data = await call({ action: "services" });
  if (!Array.isArray(data)) throw new Error("Invalid services response");
  return data as ProviderService[];
}

export async function addOrder(input: {
  service: string;
  link: string;
  quantity: number;
}): Promise<{ order?: string | number; error?: string; raw: unknown }> {
  const data = (await call({
    action: "add",
    service: input.service,
    link: input.link,
    quantity: String(input.quantity),
  })) as { order?: string | number; error?: string };
  return { order: data.order, error: data.error, raw: data };
}

export async function fetchOrderStatus(providerOrderId: string): Promise<unknown> {
  return call({ action: "status", order: providerOrderId });
}
