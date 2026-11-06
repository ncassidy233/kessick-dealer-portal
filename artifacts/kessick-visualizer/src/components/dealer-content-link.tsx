import { type ComponentProps } from "react";
import { dealerContentDestination } from "@/lib/staff-dealer-view";
import { useStaffDealerView } from "@/lib/staff-dealer-view-context";

export function DealerContentLink({ href, children, ...props }: ComponentProps<"a">) {
  const view = useStaffDealerView();
  const destination = href
    ? dealerContentDestination(href, view, window.location.origin, import.meta.env.BASE_URL)
    : href;
  if (!destination) return <span className={props.className}>{children}</span>;
  return <a {...props} href={destination}>{children}</a>;
}
