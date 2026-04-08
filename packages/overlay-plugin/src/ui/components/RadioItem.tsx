import { Label, Radio } from '@heroui/react';

export type RadioItemProps = {
  label: string;
  value: string;
};

export const RadioItem = ({ label, value }: RadioItemProps) => {
  return (
    <Radio
      value={value}
      className="min-w-0 cursor-pointer rounded-[0.7rem] border border-[var(--overlay-line)] bg-white/[0.035] px-3 py-2 text-[rgba(238,246,252,0.9)] transition-colors duration-150 hover:border-[var(--overlay-line-strong)] hover:bg-white/[0.07] hover:text-white data-[selected=true]:border-[rgba(130,50,255,0.28)] data-[selected=true]:bg-[var(--overlay-accent-soft)] data-[selected=true]:text-white"
    >
      <Radio.Content>
        <Label className="cursor-pointer text-[0.9rem] font-semibold text-current">
          {label}
        </Label>
      </Radio.Content>
    </Radio>
  );
};
