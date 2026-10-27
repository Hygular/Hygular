import { Hygular, Modal, Range, type HygularConfig } from "hygular";
import { useRange, useSwiper, useModal } from "hygular/react";

const config = { theme: { primary: "#2563eb" } } satisfies HygularConfig;
const runtime = new Hygular(config);
runtime.dispose();
const confirmed: Promise<boolean | "guard-exit"> = Modal.confirm();
void confirmed;
const host = document.createElement("div");
Range.getOrCreateInstance(host).setValue([10, 90]);

function Controls() {
  const { ref, value } = useRange({
    onInput: (next) => {
      void next;
    },
  });
  const swiper = useSwiper<HTMLDivElement>();
  const modal = useModal();
  return (
    <>
      <div ref={ref}>
        <input type="range" />
      </div>
      <output>{String(value)}</output>
      <div ref={swiper}>
        <div className="swiper-wrapper">Slides</div>
      </div>
      <button
        data-hygular-toggle="popover"
        data-content="Details"
        onClick={() => void modal.alert({ content: "Hello" })}
      >
        Open
      </button>
    </>
  );
}
void Controls;
// @ts-expect-error Unknown toggle names are rejected.
const invalid = <button data-hygular-toggle="unknown" />;
void invalid;
