---
name: Codebase Planner
description: Light desktop workspace with an editable project map and shared list.
colors:
  background: "#faf9f6"
  surface: "#fffefa"
  sidebar: "#f2f1ed"
  text: "#302e2a"
  muted: "#716e66"
  border: "#e4e2db"
  accent: "#a14d37"
  accent-soft: "#efe4dc"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
  heading:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "24px"
    fontWeight: 550
    letterSpacing: "-0.035em"
rounded:
  control: "7px"
  node: "9px"
spacing:
  compact: "7px"
  panel: "22px"
  workspace: "30px"
components:
  button-primary:
    backgroundColor: "#37322b"
    textColor: "#fffdf7"
    rounded: "{rounded.control}"
    padding: "9px 12px"
---

# Design system

## Overview

Light Codex workspace with Obsidian's tree and connected-item structure. User-approved layout and palette override the concept roll. Operate mode: navigation left, editable map/list center, inspector right. Off-white canvas, beige-gray sidebar, charcoal text, muted terracotta selection. Native system typography. Compact controls, generous canvas space, subtle borders, no decorative imagery. Map cards expose type and status without replacing the item title. List and editor provide keyboard alternatives for every canvas action.

Empty, loading, saving, failed save, missing folder, and deletion states are part of the interface. Narrow windows hide the tree behind a toggle and show the inspector as a dismissible panel. Reduced-motion preference disables transitions.

## Layout

Sidebar 240px, inspector 340px, flexible center. The inspector overlays the canvas below 1050px; sidebar collapses independently. Native window minimum 900×620. Map background dots provide spatial reference. List rows use borders rather than nested cards.

## Components

Buttons use Lucide icons with visible action text or accessible labels. Map hierarchy edges are solid and related links dashed. Selection uses a muted terracotta border. Notes render Markdown without raw HTML or fetched images. Keyboard actions mirror canvas operations in the inspector.
