import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customFetch, getDealerPortalAccess, getDealerPortalPricing,
  getGetDealerPortalAccessQueryKey, getGetDealerPortalPricingQueryKey,
  getListDealerPortalFormsQueryKey, getListDealerPortalResourcesQueryKey,
  listDealerPortalForms, listDealerPortalResources, submitDealerPortalForm, updateAccount,
} from "@workspace/api-client-react";
import { useStaffDealerView } from "@/lib/staff-dealer-view-context";
import { assertDealerWritable, dealerQueryKey, dealerReadUrl } from "@/lib/staff-dealer-view";
import { usePortalSession } from "@/lib/portal-session";
import { dealerAccessState } from "@/lib/dealer-access";

function useDealerRead<T>(path: string, originalKey: readonly unknown[]) {
  const view = useStaffDealerView();
  const session = usePortalSession();
  return useQuery({
    queryKey: dealerQueryKey(originalKey, view),
    queryFn: ({ signal }) => customFetch<T>(dealerReadUrl(path, view), { signal }),
    enabled: dealerAccessState(session) === "allowed",
  });
}

export const useGetDealerPortalAccess = () => useDealerRead<Awaited<ReturnType<typeof getDealerPortalAccess>>>("/api/dealer-portal/access", getGetDealerPortalAccessQueryKey());
export const useGetDealerPortalPricing = () => useDealerRead<Awaited<ReturnType<typeof getDealerPortalPricing>>>("/api/dealer-portal/pricing", getGetDealerPortalPricingQueryKey());
export const useListDealerPortalForms = () => useDealerRead<Awaited<ReturnType<typeof listDealerPortalForms>>>("/api/dealer-portal/forms", getListDealerPortalFormsQueryKey());
export const useListDealerPortalResources = () => useDealerRead<Awaited<ReturnType<typeof listDealerPortalResources>>>("/api/dealer-portal/resources", getListDealerPortalResourcesQueryKey());
export const useDealerPushConfig = () => useDealerRead<{ configured: boolean; publicKey: string | null }>("/api/dealer-portal/push-config", ["portal-push-config"]);

export function useDealerResourceDownload() {
  const view = useStaffDealerView();
  const client = useQueryClient();
  return (path: string) => client.fetchQuery({
    queryKey: dealerQueryKey(["dealer-resource-file", path], view),
    queryFn: ({ signal }) => customFetch<Blob>(dealerReadUrl(path, view), { responseType: "blob", signal }),
    gcTime: 0,
    staleTime: 0,
  });
}

export function useSubmitDealerPortalForm() {
  const view = useStaffDealerView();
  return useMutation({
    mutationKey: dealerQueryKey(["submitDealerPortalForm"], view),
    mutationFn: ({ formId, data }: { formId: string; data: Parameters<typeof submitDealerPortalForm>[1] }) => {
      assertDealerWritable(view);
      return submitDealerPortalForm(formId, data);
    },
  });
}

export function useUpdateAccount() {
  const view = useStaffDealerView();
  return useMutation({
    mutationKey: dealerQueryKey(["updateAccount"], view),
    mutationFn: ({ data }: { data: Parameters<typeof updateAccount>[0] }) => {
      assertDealerWritable(view);
      return updateAccount(data);
    },
  });
}
