import { defineMiddleware } from "astro:middleware";
import { getActionContext } from "astro:actions";
import { randomUUID } from "node:crypto";

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();

  const { action, setActionResult, serializeActionResult } =
    getActionContext(context);

  const currentAction = await context.session?.get("currentAction");

  if (currentAction) {
    const { actionName, actionResult } = JSON.parse(currentAction);
    setActionResult(actionName, actionResult);

    context.session?.delete("currentAction");
    return next();
  }

  if (action?.calledFrom === "form") {
    const actionResult = await action.handler();

    context.session?.set(
      "currentAction",
      JSON.stringify({
        actionName: action.name,
        actionResult: serializeActionResult(actionResult),
      }),
    );

    if (actionResult.error) {
      const referer = context.request.headers.get("Referer");
      if (!referer) {
        throw new Error(
          "Internal: Referer unexpectedly missing from Action POST request.",
        );
      }
      return context.redirect(referer);
    }

    return context.redirect(context.originPathname);
  }

  return next();
});
