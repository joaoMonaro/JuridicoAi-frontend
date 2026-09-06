import { forwardRef } from "react";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

import { navigate } from "@/app/navigation";

type AppLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  replace?: boolean;
};

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { href, replace = false, onClick, target, download, ...props },
  ref,
) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      download ||
      (target && target !== "_self")
    ) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    navigate(url.href, { replace });
  }

  return <a ref={ref} href={href} target={target} download={download} onClick={handleClick} {...props} />;
});
