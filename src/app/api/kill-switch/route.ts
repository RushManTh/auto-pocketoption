import { NextResponse } from "next/server";
import { z } from "zod";

const killSwitchRequestSchema = z.object({
  enabled: z.boolean()
});

export async function POST(request: Request) {
  const body = killSwitchRequestSchema.parse(await request.json());

  // TODO: persist SystemSetting and write AuditLog.
  return NextResponse.json({
    ok: true,
    killSwitch: body.enabled
  });
}

