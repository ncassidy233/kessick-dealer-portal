import { type ComponentProps, useContext } from "react";
import { dealerPreviewLinkUrl } from "@workspace/api-client-react";
import { DealerPreviewContext } from "@/lib/portal-session";

export function DealerContentLink({ href, children, ...props }: ComponentProps<"a">) {
  const dealerId = useContext(DealerPreviewContext);
  const destination = dealerId && href
    ? dealerPreviewLinkUrl(href, new URL(window.location.href), import.meta.env.BASE_URL)
    : href;
  if (!destination) return <span className={props.className}>{children}</span>;
  return <a {...props} href={destination}>{children}</a>;
}
