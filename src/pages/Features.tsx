import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import {
  ShoppingBag,
  Gift,
  Link2,
  Shield,
  Hand,
  Star,
  Pin,
  Wrench,
  Terminal,
  Clock,
  Heart,
  ToggleLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import { apiFetch } from "@/hooks/useApi";

interface Feature {
  key: string;
  label: string;
  desc: string;
  icon: string;
  enabled: boolean;
  cogs: string[];
}

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag,
  Gift,
  Link2,
  Shield,
  Hand,
  Star,
  Pin,
  Wrench,
  Terminal,
  Clock,
  Heart,
};

async function fetchFeatures(): Promise<Feature[]> {
  const res = await apiFetch("/api/features");
  if (!res.ok) throw new Error("Failed to load features");
  return res.json();
}

async function updateFeatures(features: Record<string, boolean>): Promise<Feature[]> {
  const res = await apiFetch("/api/features", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ features }),
  });
  if (!res.ok) throw new Error("Update failed");
  return res.json();
}

function FeatureCardSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-5 flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="h-5 w-9 rounded-full" />
      </CardContent>
    </Card>
  );
}

export function Features() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useT();

  const { data: features, isLoading } = useQuery<Feature[]>({
    queryKey: ["features"],
    queryFn: fetchFeatures,
  });

  const mutation = useMutation({
    mutationFn: updateFeatures,
    onMutate: async (newState) => {
      await queryClient.cancelQueries({ queryKey: ["features"] });
      const previous = queryClient.getQueryData<Feature[]>(["features"]);

      queryClient.setQueryData<Feature[]>(["features"], (old) =>
        old?.map((f) => ({
          ...f,
          enabled: newState[f.key] ?? f.enabled,
        }))
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["features"], context.previous);
      }
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("features_updateFailed"),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["features"] });
    },
  });

  function handleToggle(key: string, enabled: boolean) {
    mutation.mutate({ [key]: enabled });
  }

  return (
    <PageContainer size="lg">
      <PageHeader title={t("features_title")} icon={ToggleLeft} description={t("features_desc")} />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <FeatureCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features?.map((feature) => {
            const Icon = ICON_MAP[feature.icon];
            return (
              <Card
                key={feature.key}
                className={cn(
                  "rounded-xl transition-opacity duration-200",
                  !feature.enabled && "opacity-50"
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={cn(
                        "flex items-center justify-center h-10 w-10 rounded-lg shrink-0",
                        feature.enabled
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {Icon ? <Icon className="h-5 w-5" /> : null}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold leading-none">
                          {feature.label}
                        </CardTitle>
                        {feature.enabled && (
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500 shrink-0" />
                        )}
                      </div>
                      <CardDescription className="text-xs mt-1.5 leading-relaxed">
                        {feature.desc}
                      </CardDescription>
                    </div>

                    {/* Switch */}
                    <Switch
                      checked={feature.enabled}
                      onCheckedChange={(checked) =>
                        handleToggle(feature.key, checked)
                      }
                      disabled={mutation.isPending}
                      aria-label={`Toggle ${feature.label}`}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

export default Features;
