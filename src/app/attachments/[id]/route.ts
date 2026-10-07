import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Opens an attachment through a short lived signed URL. RLS on the
// attachments table decides whether the caller may see it.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("attachments").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });
  const { data: signed, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(data.storage_path, 60, { download: data.file_name });
  if (error || !signed) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
