import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { AuthProvider } from "../features/auth/AuthProvider";

describe("App", () => {
  it("renders the SLAB public shell", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "SLAB" })).toBeInTheDocument();
    expect(screen.getByText(/construction marketplace foundation/i)).toBeInTheDocument();
  });
});
