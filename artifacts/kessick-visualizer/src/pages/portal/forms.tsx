import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  useListDealerPortalForms,
  useSubmitDealerPortalForm,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { usePortalContent, type PortalContent } from "@/hooks/use-portal-v2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type FormField = {
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: unknown[];
};

type SupportedFieldType = "text" | "email" | "number" | "date" | "textarea" | "select";
type FormValues = { fields: string[] };
const supportedTypes: SupportedFieldType[] = ["text", "email", "number", "date", "textarea", "select"];

function fieldName(field: FormField, index: number) {
  return field.name?.trim() || `field_${index + 1}`;
}

function fieldOptions(field: FormField) {
  return Array.isArray(field.options)
    ? field.options.filter((option): option is string => typeof option === "string" && option.length > 0)
    : [];
}

export function validateField(field: FormField, value: string): true | string {
  const trimmed = value.trim();
  if (!trimmed) return field.required ? "This field is required." : true;
  if (field.type === "select" && !fieldOptions(field).includes(value)) {
    return "Choose one of the available options.";
  }
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address.";
  }
  if (field.type === "number" && !Number.isFinite(Number(trimmed))) {
    return "Enter a valid number.";
  }
  if (field.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
      Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`)) ||
      new Date(`${trimmed}T00:00:00Z`).toISOString().slice(0, 10) !== trimmed) {
      return "Enter a valid date.";
    }
  }
  return true;
}

export function definitionError(fields: FormField[]) {
  const names = new Set<string>();
  for (const [index, field] of fields.entries()) {
    const name = fieldName(field, index);
    if (names.has(name)) return `This form has duplicate field names (${name}). Please contact your Kessick representative.`;
    names.add(name);
    if (!supportedTypes.includes(field.type as SupportedFieldType) || !field.label?.trim()) {
      return "This form contains an unsupported or unnamed field. Please contact your Kessick representative.";
    }
    if (field.type === "select" && fieldOptions(field).length === 0) {
      return `“${field.label}” has no choices yet. Please contact your Kessick representative.`;
    }
  }
  return null;
}

export function submissionValues(fields: FormField[], response: FormValues) {
  const values: Record<string, unknown> = Object.create(null);
  fields.forEach((field, index) => {
    const raw = response.fields[index] ?? "";
    if (!raw.trim()) return;
    values[fieldName(field, index)] = field.type === "number" ? Number(raw.trim())
      : field.type === "textarea" || field.type === "select" ? raw : raw.trim();
  });
  return values;
}

type LegacyForm = {
  id: string;
  title: string;
  description?: string | null;
  fieldDefinitions?: FormField[];
  enabled?: boolean;
};

type DisplayForm = {
  id: string;
  title: string;
  description?: string | null;
  legacy?: LegacyForm;
  content?: PortalContent;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function legacyId(content: PortalContent) {
  return typeof content.payload?.legacyId === "string" ? content.payload.legacyId : null;
}

export default function PortalForms() {
  // The legacy endpoint remains authoritative for form definitions and
  // submissions. The v2 records add the current audience and presentation
  // metadata, but must never replace the legacy form fetch.
  const legacyQuery = useListDealerPortalForms();
  const contentQuery = usePortalContent("form");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const forms = useMemo<DisplayForm[]>(() => {
    const legacyForms = (legacyQuery.data ?? []) as LegacyForm[];
    const legacyById = new Map(legacyForms.map((form) => [form.id, form]));
    const contentByLegacyId = new Map(
      (contentQuery.data?.content ?? [])
        .map((content) => [legacyId(content), content] as const)
        .filter((entry): entry is [string, PortalContent] => Boolean(entry[0])),
    );

    const merged: DisplayForm[] = legacyForms.map((form) => {
      const content = contentByLegacyId.get(form.id);
      return {
        id: form.id,
        title: content?.title || form.title,
        description: content?.description ?? form.description,
        legacy: form,
        content,
      };
    });
    const knownLegacyIds = new Set(legacyForms.map((form) => form.id));

    // A v2-only form is shown so a content configuration issue is visible,
    // but it is not made submit-able without the legacy endpoint that stores
    // its submissions.
    for (const content of contentQuery.data?.content ?? []) {
      const linkedId = legacyId(content);
      if (linkedId && knownLegacyIds.has(linkedId)) continue;
      merged.push({
        id: `content-${content.id}`,
        title: content.title,
        description: content.description,
        content,
      });
    }
    return merged;
  }, [contentQuery.data?.content, legacyQuery.data]);

  if (legacyQuery.isLoading || contentQuery.isLoading) {
    return <LoadingState />;
  }

  if (legacyQuery.error) {
    return <ErrorState message={`Unable to load forms: ${errorMessage(legacyQuery.error)}`} />;
  }

  const selectedForm = forms.find((form) => form.id === selectedFormId);
  if (selectedForm) {
    return (
      <FormRenderer
        form={selectedForm}
        onBack={() => setSelectedFormId(null)}
      />
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-8 p-6 md:mx-auto md:p-10">
      <header className="space-y-2 border-b border-[#121210]/10 pb-6">
        <h1 className="flex items-center gap-3 text-3xl font-light tracking-tight text-[#121210]">
          <FileText className="h-8 w-8 text-[#B39862]" />
          Order Forms
        </h1>
        <p className="text-[#121210]/60">
          Submit custom orders, sign-offs, and service requests.
        </p>
      </header>

      {contentQuery.error && (
        <div className="flex items-start gap-3 border border-[#B39862]/40 bg-[#B39862]/10 p-4 text-sm text-[#121210]/75">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#8b382b]" />
          <p>
            Some newer form content could not be loaded. Existing forms remain
            available. {errorMessage(contentQuery.error)}
          </p>
        </div>
      )}

      {forms.length === 0 ? (
        <div className="border border-[#121210]/10 bg-white p-12 text-center text-[#121210]/50">
          No forms are currently available for your account.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {forms.map((form) => {
            const isUnavailable = !form.legacy;
            return (
              <button
                key={form.id}
                type="button"
                disabled={isUnavailable}
                onClick={() => setSelectedFormId(form.id)}
                className="group flex flex-col border border-[#121210]/10 bg-white p-6 text-left transition-colors hover:border-[#B39862]/60 focus:outline-none focus:ring-1 focus:ring-[#B39862] disabled:cursor-not-allowed disabled:opacity-65"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-medium text-[#121210] transition-colors group-hover:text-[#806936]">
                    {form.title}
                  </h2>
                  {isUnavailable && (
                    <span className="shrink-0 text-[10px] uppercase tracking-widest text-[#8b382b]">
                      Unavailable
                    </span>
                  )}
                </div>
                {form.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-[#121210]/60">
                    {form.description}
                  </p>
                )}
                {isUnavailable && (
                  <p className="mt-4 border-t border-[#121210]/10 pt-3 text-xs text-[#8b382b]">
                    This form is not linked to a submission service yet.
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormRenderer({
  form,
  onBack,
}: {
  form: DisplayForm;
  onBack: () => void;
}) {
  const submitMutation = useSubmitDealerPortalForm();
  const [submitted, setSubmitted] = useState(false);
  const fields = Array.isArray(form.legacy?.fieldDefinitions) ? form.legacy.fieldDefinitions : [];
  const configurationError = definitionError(fields);
  const formMethods = useForm<FormValues>({
    defaultValues: { fields: fields.map(() => "") },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  if (!form.legacy) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 p-6 md:p-10">
        <Button
          variant="ghost"
          className="rounded-none pl-0 text-[#121210]/70 hover:bg-transparent hover:text-[#806936]"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forms
        </Button>
        <div className="border border-[#8b382b]/30 bg-[#8b382b]/5 p-6 text-[#8b382b]">
          <h1 className="text-xl font-medium">{form.title}</h1>
          <p className="mt-2 text-sm">
            This form is missing its legacy submission endpoint and cannot be
            submitted. Please contact your Kessick representative.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = (response: FormValues) => {
    if (configurationError || fields.length === 0) return;
    submitMutation.mutate(
      {
        formId: form.legacy!.id,
        data: { values: submissionValues(fields, response) },
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          toast.success("Form submitted successfully");
        },
        onError: (error) => toast.error(`Failed to submit form: ${errorMessage(error)}`),
      },
    );
  };

  if (submitted) {
    return (
      <div className="mx-auto mt-12 w-full max-w-3xl space-y-6 border border-[#121210]/10 bg-white p-8 text-center md:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#B39862]/15">
          <CheckCircle2 className="h-8 w-8 text-[#806936]" />
        </div>
        <h1 className="text-2xl font-light text-[#121210]">Submission Received</h1>
        <p className="text-[#121210]/60">
          Your response for “{form.title}” has been saved.
        </p>
        <Button
          onClick={onBack}
          variant="outline"
          className="mt-4 rounded-none border-[#121210]/20"
        >
          Return to Forms
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6 md:p-10">
      <Button
        variant="ghost"
        className="rounded-none pl-0 text-[#121210]/70 hover:bg-transparent hover:text-[#806936]"
        onClick={onBack}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forms
      </Button>

      <header className="space-y-2 border-b border-[#121210]/10 pb-6">
        <h1 className="text-3xl font-light tracking-tight text-[#121210]">{form.title}</h1>
        {form.description && (
          <p className="text-[#121210]/60">{form.description}</p>
        )}
      </header>

      <Form {...formMethods}>
        <form onSubmit={formMethods.handleSubmit(handleSubmit)} noValidate className="space-y-6">
        {configurationError && (
          <p role="alert" data-testid="status-form-configuration-error" className="border border-[#8b382b]/30 bg-[#8b382b]/5 p-3 text-sm text-[#8b382b]">
            {configurationError}
          </p>
        )}
        {fields.length === 0 ? (
          <div className="border border-[#121210]/10 bg-white p-6 text-sm text-[#121210]/60">
            This form has no fields yet.
          </div>
        ) : (
          fields.map((field, index) => {
            const name = fieldName(field, index);
            const label = field.label?.trim() || `Field ${index + 1}`;
            const type = supportedTypes.includes(field.type as SupportedFieldType) ? field.type : "text";
            const options = fieldOptions(field);

            return (
              <FormField
                key={`${name}-${index}`}
                control={formMethods.control}
                name={`fields.${index}`}
                rules={{ validate: (value) => validateField(field, value) }}
                render={({ field: input }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-[#121210]">
                      {label} {field.required && <span aria-label="required" className="text-[#8b382b]">*</span>}
                    </FormLabel>
                    <FormControl>
                      {field.type === "textarea" ? (
                        <Textarea
                          {...input}
                          data-testid={`input-form-field-${index}`}
                          className="min-h-28 resize-y rounded-none border-[#121210]/20 bg-white text-[#121210] focus-visible:ring-[#B39862]"
                          rows={4}
                        />
                      ) : field.type === "select" ? (
                        <select
                          {...input}
                          data-testid={`select-form-field-${index}`}
                          className="flex h-10 w-full rounded-none border border-[#121210]/20 bg-white px-3 py-2 text-sm text-[#121210] outline-none focus:ring-1 focus:ring-[#B39862]"
                        >
                          <option value="">Select an option</option>
                          {options.map((option, optionIndex) => (
                            <option key={`${option}-${optionIndex}`} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          {...input}
                          data-testid={`input-form-field-${index}`}
                          type={type}
                          step={type === "number" ? "any" : undefined}
                          className="rounded-none border-[#121210]/20 bg-white text-[#121210] focus-visible:ring-[#B39862]"
                        />
                      )}
                    </FormControl>
                    <FormMessage className="text-[#8b382b]" />
                  </FormItem>
                )}
              />
            );
          })
        )}

        {submitMutation.error && (
          <p role="alert" data-testid="status-form-submission-error" className="border border-[#8b382b]/30 bg-[#8b382b]/5 p-3 text-sm text-[#8b382b]">
            {errorMessage(submitMutation.error)}
          </p>
        )}
        <div className="flex justify-end border-t border-[#121210]/10 pt-4">
          <Button
            type="submit"
            data-testid="button-submit-form"
            disabled={submitMutation.isPending || fields.length === 0 || Boolean(configurationError)}
            className="w-full rounded-none bg-[#121210] px-8 text-[#F3F0E8] hover:bg-[#121210]/85 md:w-auto"
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Form"}
          </Button>
        </div>
        </form>
      </Form>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#B39862]" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-6 md:p-10">
      <div className="mx-auto flex max-w-2xl items-start gap-3 border border-[#8b382b]/30 bg-[#8b382b]/5 p-5 text-[#8b382b]">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="font-medium">Forms are unavailable</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}