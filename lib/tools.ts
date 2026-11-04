import { tool } from "ai";
import { z } from "zod";
import { ApiRequestError, createReturn, getCategories, getOrder, getProductById, getProductStock, getProducts, preauthorizeRefund, notifyReturnInProcess } from "@/lib/api";
import { formatPrice } from "@/lib/format";

export const searchProducts = tool({
    description: `Search the Vercel swag store product catalog and return a SHORTLIST of matching products. Use this for broad or open-ended lookups: "what hoodies do you have", "show me something for my desk", "what do you sell", or any request that could match more than one product.

Returns only summary fields (id, slug, name, one thumbnail image, price, category, description) — it does NOT include full image sets, tags, or live stock.

Do NOT use this to answer a question about one specific item the user has already identified. Once you know which product the user means, call getProductDetails with that product's id or slug instead of answering from these summary fields.`,
    inputSchema: z.object({
        query: z
            .string()
            .optional()
            .describe(
                `Optional free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
            ),
        category: z
            .string()
            .optional()
            .describe(
                `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`,
            ),
    }),
    execute: async ({ query, category }) => {
        try {
            const products = await getProducts({
                search: query,
                category,
                limit: 10,
            });
            return {
                count: products.length,
                products: products.map((p) => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    image: p.images[0],
                    price: p.price,
                    currency: p.currency,
                    category: p.category,
                    description: p.description,
                })),
            };
        } catch (err) {
            const message =
                err instanceof ApiRequestError ? err.message : "Unknown error";
            return { count: 0, products: [], error: message };
        }
    },
});

export const getProductDetails = tool({
    description: `Get the FULL detail record for ONE product: complete description, formatted price, every product image (not just the thumbnail), tags, featured flag, and LIVE stock levels (exact units remaining, in-stock and low-stock flags), plus a few related products from the same category.

Use this whenever the user asks about a specific item they have already identified — "tell me more about the black hoodie", "is it in stock", "how much is the water bottle", "what does it look like", "what else goes with it". Prefer this over reporting whatever fields searchProducts happened to return: searchProducts gives summaries, this gives the authoritative record.

Stock is fetched live and is never cached, so this is the ONLY tool that can answer availability questions correctly.

Requires a product id or slug. If you don't know it yet, call searchProducts first to resolve the user's wording to a product, then call this tool with that id. If the user's wording is ambiguous between several products, show the shortlist and ask which one before calling this.`,
    inputSchema: z.object({
        idOrSlug: z
            .string()
            .describe(
                `The product's id (e.g. 'hoodie_001') or slug (e.g. 'black-pullover-hoodie'). Both work. Use the id or slug returned by searchProducts — do not invent one from the product's display name.`,
            ),
        includeRelated: z
            .boolean()
            .optional()
            .default(true)
            .describe(
                `Whether to also return up to 4 other products from the same category. Set false when the user only wants facts about this one item.`,
            ),
    }),
    execute: async ({ idOrSlug, includeRelated = true }) => {
        try {
            const product = await getProductById(idOrSlug);

            // Stock lives behind a separate uncached endpoint, and related
            // products behind a catalog query. Fan them out in parallel and
            // let either degrade on its own — a stock outage shouldn't cost
            // the user the product description.
            const [stockResult, relatedResult] = await Promise.allSettled([
                getProductStock(product.id),
                includeRelated
                    ? getProducts({ category: product.category, limit: 5 })
                    : Promise.resolve([]),
            ]);

            const stock =
                stockResult.status === "fulfilled" ? stockResult.value : null;

            const related =
                relatedResult.status === "fulfilled"
                    ? relatedResult.value
                          .filter((p) => p.id !== product.id)
                          .slice(0, 4)
                          .map((p) => ({
                              id: p.id,
                              slug: p.slug,
                              name: p.name,
                              image: p.images[0] ?? null,
                              price: p.price,
                              priceFormatted: formatPrice(p.price, p.currency),
                          }))
                    : [];

            return {
                product: {
                    id: product.id,
                    slug: product.slug,
                    name: product.name,
                    description: product.description,
                    // `price` is an integer in cents; quote `priceFormatted`
                    // to the user so the agent never does the cent math.
                    price: product.price,
                    currency: product.currency,
                    priceFormatted: formatPrice(product.price, product.currency),
                    category: product.category,
                    images: product.images,
                    primaryImage: product.images[0] ?? null,
                    imageCount: product.images.length,
                    tags: product.tags,
                    featured: product.featured,
                    createdAt: product.createdAt,
                },
                availability: stock
                    ? {
                          stock: stock.stock,
                          inStock: stock.inStock,
                          lowStock: stock.lowStock,
                          summary: !stock.inStock
                              ? "Out of stock"
                              : stock.lowStock
                                ? `Low stock — only ${stock.stock} left`
                                : `In stock (${stock.stock} available)`,
                      }
                    : {
                          unavailable: true,
                          summary:
                              "Live stock lookup failed — tell the user you couldn't confirm availability rather than guessing.",
                      },
                // The catalog API exposes no size/variant data, so there are no
                // sizes to report. Say so plainly instead of inventing a range.
                sizes: null,
                relatedProducts: related,
            };
        } catch (err) {
            if (err instanceof ApiRequestError && err.status === 404) {
                return {
                    error: `No product found for '${idOrSlug}'. Use searchProducts to find the right id or slug, then try again.`,
                };
            }
            const message =
                err instanceof ApiRequestError ? err.message : "Unknown error";
            return { error: message };
        }
    },
});

export const getAllCategories = tool({
    description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
    inputSchema: z.object({}),
    execute: async () => {
        try {
            const categories = await getCategories();
            return {
                count: categories.length,
                categories: categories.map((c) => ({
                    slug: c.slug,
                    name: c.name,
                    productCount: c.productCount,
                })),
            };
        } catch (err) {
            const message =
                err instanceof ApiRequestError ? err.message : "Unknown error";
            return { count: 0, categories: [], error: message };
        }
    },
});

export const returnOrder = tool({
    description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
    inputSchema: z.object({
        orderId: z
            .string()
            .describe("The order ID the user wants to return."),
        reason: z
            .string()
            .min(10)
            .max(500)
            .describe("Why the user is returning the order."),
    }),
    execute: async ({ orderId, reason }) => {
        try {
            const order = await getOrder(orderId);
            await notifyReturnInProcess(orderId);
            await preauthorizeRefund(orderId);
            const filed = await createReturn({
                orderId: order.id,
                items: order.items.map((i) => ({
                    productId: i.productId,
                    quantity: i.quantity,
                })),
                reason,
            });
            return { returnId: filed.id, status: filed.status };
        } catch (err) {
            const message =
                err instanceof ApiRequestError ? err.message : "Unknown error";
            return { error: message };
        }
    },
});