"use client";

import React, { useState } from "react";
import { ROLES, type Role, type Session } from "@/lib/auth";

interface SignInProps {
  onSignIn: (session: Session) => void;
}

/**
 * Entry screen for the console. Captures who is on shift and in which role so
 * the two-person payout approval is attributed to a real, signed-in person
 * rather than a hardcoded ID. Deliberately plain and low-friction — one name,
 * one role, one button.
 */
export function SignIn({ onSignIn }: SignInProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("county_officer");

  const canContinue = name.trim().length >= 2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    onSignIn({ name: name.trim(), role });
  };

  return (
    <div className="signin">
      <form className="signin__card" onSubmit={handleSubmit}>
        <div className="signin__brand">
          <span className="signin__mark" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 28 28" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 16 Q14 9 24 16" />
              <path d="M6.5 11.5 Q14 6.5 21.5 11.5" opacity="0.6" />
              <path d="M9 20.5 Q14 16.5 19 20.5" opacity="0.4" />
              <circle cx="14" cy="22" r="1.3" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div>
            <div className="signin__title">resili</div>
            <div className="signin__subtitle">Lake Victoria Basin · Flood early-action command centre</div>
          </div>
        </div>

        <p className="signin__lead">
          Sign in for your shift. Your name and role are recorded on every
          decision you approve, for the audit trail.
        </p>

        <label className="signin__label" htmlFor="signin-name">Your name</label>
        <input
          id="signin-name"
          className="signin__input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Achieng Otieno"
          autoComplete="name"
        />

        <div className="signin__label">Your role</div>
        <div className="signin__roles">
          {ROLES.map((r) => (
            <button
              type="button"
              key={r.role}
              className={`signin__role ${role === r.role ? "signin__role--active" : ""}`}
              onClick={() => setRole(r.role)}
            >
              <span className="signin__role-label">{r.label}</span>
              <span className="signin__role-blurb">{r.blurb}</span>
            </button>
          ))}
        </div>

        <button type="submit" className="signin__submit" disabled={!canContinue}>
          Enter command centre
        </button>

        <p className="signin__note">
          resili is a decision-support tool. Forecasts are probabilistic
          estimates — always follow official directives from KMD and NDMA.
        </p>
      </form>
    </div>
  );
}
