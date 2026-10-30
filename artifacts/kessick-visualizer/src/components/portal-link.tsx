import { Link } from "wouter";
import type { ComponentProps } from "react";
import { useStaffDealerView } from "@/lib/staff-dealer-view-context";
import { portalDestination } from "@/lib/staff-dealer-view";

export function PortalLink({ href = "", ...props }: ComponentProps<"a">) {
  const view = useStaffDealerView();
  return <Link {...props} href={portalDestination(href, view)} />;
}
