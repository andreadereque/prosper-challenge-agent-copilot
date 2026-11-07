import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeAgent } from "../test/fixtures";
import { Editor } from "./Editor";
import { TEST_CALL_URL } from "./Toolbar";

const user = userEvent.setup();

function respondWith(status: number, body: unknown = {}) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }));
}

function editAndSave() {
  render(<Editor initialAgent={makeAgent()} />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Front desk" } });
  return user.click(screen.getByRole("button", { name: "Save" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Editor saving and calling", () => {
  it("links to the test call while everything is saved", () => {
    render(<Editor initialAgent={makeAgent()} />);

    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", TEST_CALL_URL);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("disables the call until changes are saved", () => {
    render(<Editor initialAgent={makeAgent()} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Front desk" } });

    expect(screen.getByRole("button", { name: "Call" })).toBeDisabled();
  });

  it("saves and clears the unsaved marker", async () => {
    respondWith(200);

    await editAndSave();

    expect(await screen.findByRole("link", { name: "Call" })).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("shows every reason the agent was not saved and keeps the changes", async () => {
    respondWith(422, { errors: ["Node 'x' cannot be reached from the initial node."] });

    await editAndSave();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The agent was not saved. Fix these first:Node 'x' cannot be reached from the initial node.",
    );
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("explains when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed to fetch")));

    await editAndSave();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save. Failed to fetch");
  });

  it("shows that it is saving", async () => {
    let finishSaving = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          finishSaving = () => resolve({ ok: true, status: 200, json: async () => ({}) });
        }),
      ),
    );

    await editAndSave();

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finishSaving();
    expect(await screen.findByRole("link", { name: "Call" })).toBeInTheDocument();
  });
});
