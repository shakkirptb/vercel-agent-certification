"use client";

import Image from "next/image";
import Link from "next/link";
import type { ProductDetailsToolInvocation } from "@/lib/agent";

interface AgentProductCardProps {
    invocation: ProductDetailsToolInvocation;
}

export function AgentProductCard({ invocation }: AgentProductCardProps) {
    if (
        invocation.state === "input-streaming" ||
        invocation.state === "input-available"
    ) {
        const idOrSlug = invocation.input?.idOrSlug;
        return (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Looking up{idOrSlug ? ` "${idOrSlug}"` : ""}…
            </div>
        );
    }

    if (invocation.state !== "output-available") return null;

    const output = invocation.output;

    if (!output) return null;

    if ("error" in output) {
        return (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {output.error}
            </div>
        );
    }

    const { product, availability, relatedProducts } = output;
    const image = product.primaryImage ?? product.images[0];

    const availabilityTone =
        "unavailable" in availability
            ? "text-muted-foreground"
            : !availability.inStock
              ? "text-destructive"
              : availability.lowStock
                ? "text-amber-600 dark:text-amber-500"
                : "text-emerald-600 dark:text-emerald-500";

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            {image && (
                <Link
                    href={`/products/${product.slug}`}
                    className="relative block aspect-4/3 bg-secondary"
                >
                    <Image
                        src={image}
                        alt={product.name}
                        fill
                        sizes="(min-width: 768px) 480px, 100vw"
                        className="object-cover transition-opacity hover:opacity-90"
                    />
                </Link>
            )}
            <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold leading-tight">
                            {product.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {product.priceFormatted}
                        </p>
                    </div>
                    {product.featured && (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            Featured
                        </span>
                    )}
                </div>

                <p className={`text-sm font-medium ${availabilityTone}`}>
                    {availability.summary}
                </p>

                <p className="line-clamp-3 text-sm text-muted-foreground">
                    {product.description}
                </p>

                {product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {product.tags.slice(0, 5).map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <Link
                    href={`/products/${product.slug}`}
                    className="inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                    View product →
                </Link>

                {relatedProducts.length > 0 && (
                    <div className="border-t border-border pt-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Related
                        </p>
                        <ul className="divide-y divide-border">
                            {relatedProducts.map((related) => (
                                <li key={related.id}>
                                    <Link
                                        href={`/products/${related.slug}`}
                                        className="flex items-center gap-3 py-2 transition-colors hover:bg-secondary/50"
                                    >
                                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                                            {related.image && (
                                                <Image
                                                    src={related.image}
                                                    alt={related.name}
                                                    fill
                                                    sizes="40px"
                                                    className="object-cover"
                                                />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm leading-tight">
                                                {related.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {related.priceFormatted}
                                            </p>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
