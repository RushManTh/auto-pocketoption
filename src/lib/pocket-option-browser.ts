import { env } from "@/lib/env";

export function pocketOptionBrowserOptions() {
  return {
    channel: env.POCKET_OPTION_BROWSER_CHANNEL,
    headless: env.POCKET_OPTION_HEADLESS,
    viewport: {
      width: 1440,
      height: 1000
    }
  };
}
