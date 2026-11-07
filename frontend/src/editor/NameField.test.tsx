import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NameField } from "./NameField";

const user = userEvent.setup();

function renderField(isTaken = (name: string) => name === "taken") {
  const onCommit = vi.fn();
  render(<NameField label="Name" value="greeting" isTaken={isTaken} onCommit={onCommit} />);
  return { onCommit, input: screen.getByLabelText("Name") };
}

describe("NameField", () => {
  it("commits a valid name when you press Enter", async () => {
    const { onCommit, input } = renderField();

    await user.clear(input);
    await user.type(input, "welcome{Enter}");

    expect(onCommit).toHaveBeenCalledWith("welcome");
  });

  it("commits when you leave the field", async () => {
    const { onCommit, input } = renderField();

    await user.type(input, "_new");
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith("greeting_new");
  });

  it("does nothing when the name did not change", async () => {
    const { onCommit, input } = renderField();

    await user.click(input);
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["", "Name cannot be empty."],
    ["two words", "Use only letters, numbers, - and _."],
    ["taken", '"taken" is already used.'],
  ])("rejects %j", async (name, message) => {
    const { onCommit, input } = renderField();

    await user.clear(input);
    if (name) {
      await user.type(input, name);
    }
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
