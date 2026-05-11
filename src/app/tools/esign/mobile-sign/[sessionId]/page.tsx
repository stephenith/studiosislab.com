import MobileSignClient from "./MobileSignClient";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <MobileSignClient sessionId={sessionId} />;
}
