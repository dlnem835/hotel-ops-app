import Image from "next/image";
import { ONE_EYRIE_BRAND } from "@/app/lib/one-eyrie-brand";

type OneEyriePlaceholderIconProps = {
  className?: string;
};

export default function OneEyriePlaceholderIcon({ className }: OneEyriePlaceholderIconProps) {
  return (
    <Image
      src={ONE_EYRIE_BRAND.placeholderIcon}
      alt={ONE_EYRIE_BRAND.alt}
      width={512}
      height={512}
      className={className ? `one-eyrie-placeholder-icon ${className}` : "one-eyrie-placeholder-icon"}
      priority
    />
  );
}
