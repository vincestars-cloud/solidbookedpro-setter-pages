import { ApplicationFunnel } from "@/components/ApplicationFunnel";
import { publicConfig } from "@/lib/config";

export default function Home() {
  return <ApplicationFunnel config={publicConfig} />;
}
