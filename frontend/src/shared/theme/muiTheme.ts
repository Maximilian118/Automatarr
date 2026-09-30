import { createTheme, Theme } from "@mui/material/styles"
import { ResolvedTheme, ThemeTokens } from "./themeMode"

// Build the MUI theme from the Reservoir tokens so MUI inputs match the rest of the interface.
// Sizes guarantee 44px touch targets (WCAG 2.5.5) for every interactive MUI control.
export const createAppTheme = (tokens: ThemeTokens, mode: ResolvedTheme): Theme =>
  createTheme({
    palette: {
      mode,
      primary: { main: tokens.accent, contrastText: tokens.accentInk },
      secondary: { main: tokens.inkMuted },
      error: { main: tokens.outflow },
      success: { main: tokens.good },
      warning: { main: tokens.threshold },
      info: { main: tokens.accent },
      background: { default: tokens.abyss, paper: tokens.basin },
      text: { primary: tokens.ink, secondary: tokens.inkMuted },
      divider: tokens.lineSoft,
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: tokens.fontBody,
      button: { textTransform: "none", fontWeight: 700, fontSize: "1rem", letterSpacing: 0 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 44, borderRadius: 10, paddingInline: 20 },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { minWidth: 44, minHeight: 44 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.basinRaised,
            minHeight: 48,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.line },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { color: tokens.inkMuted },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: { fontSize: "0.875rem" },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          // 44px hit area; the thumb sits fully inside a 42×22 track so it is visible on any surface
          root: { width: 64, height: 44, padding: 11 },
          // Off: muted thumb on an outlined, sunken track. On: contrasting thumb on the accent track
          switchBase: {
            padding: 14,
            color: tokens.inkMuted,
            "&.Mui-checked, &.Mui-checked.MuiSwitch-colorPrimary": { transform: "translateX(20px)", color: tokens.accentInk },
            "&.Mui-checked + .MuiSwitch-track, &.Mui-checked.MuiSwitch-colorPrimary + .MuiSwitch-track": {
              opacity: 1,
              backgroundColor: tokens.accent,
              boxShadow: "none",
            },
            "&.Mui-disabled + .MuiSwitch-track": { opacity: 0.45 },
            "&.Mui-disabled .MuiSwitch-thumb": { opacity: 0.6 },
          },
          thumb: { width: 16, height: 16, boxShadow: "none" },
          track: {
            borderRadius: 11,
            opacity: 1,
            backgroundColor: tokens.basinSunken,
            boxShadow: `inset 0 0 0 1px ${tokens.line}`,
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: { padding: 10 },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.basin,
            border: `1px solid ${tokens.lineSoft}`,
            backgroundImage: "none",
          },
          option: { minHeight: 44 },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.basin,
            border: `1px solid ${tokens.lineSoft}`,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { minHeight: 44 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: tokens.basin,
            border: `1px solid ${tokens.lineSoft}`,
            borderRadius: 18,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: tokens.ink,
            color: tokens.inkInverse,
            fontSize: "0.875rem",
            lineHeight: 1.4,
            padding: "8px 12px",
          },
          arrow: { color: tokens.ink },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontSize: "0.875rem", fontWeight: 600 },
          clickable: { minHeight: 44, borderRadius: 22, paddingInline: 6 },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { height: 8, borderRadius: 4, backgroundColor: tokens.basinSunken },
          bar: { borderRadius: 4 },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, alignItems: "center" },
        },
      },
    },
  })
