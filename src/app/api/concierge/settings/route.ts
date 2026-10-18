import { NextResponse } from "next/server";
import { readAgentSettings, DEFAULT_AGENT_SETTINGS } from "../../../lib/agent-settings";
import { isModelConfigured, isVisionEnabled } from "../../../lib/concierge/model";
import { createServerSupabase, isSupabaseConfigured } from "../../../lib/supabase-server";

/**
 * What the chat button on the shop needs to know before it shows itself:
 * whether the assistant is on, its greeting, and which features to offer.
 * Public and secret-free (the owner's switches, migration 65).
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = isSupabaseConfigured ? await readAgentSettings(createServerSupabase()) : DEFAULT_AGENT_SETTINGS;
  return NextResponse.json(
    {
      // Without a model key the assistant can't answer, so it isn't offered.
      enabled: settings.enabled && isModelConfigured,
      greeting: settings.greeting,
      photos: settings.photosEnabled && isVisionEnabled,
      orderHelp: settings.orderHelpEnabled,
      nudges: settings.nudgesEnabled,
    },
    { headers: { "Cache-Control": "private, max-age=15" } }
  );
}
