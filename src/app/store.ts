import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  commandOpen: boolean
  quickActionsOpen: boolean
  notificationsOpen: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  setMobileNavOpen: (v: boolean) => void
  setCommandOpen: (v: boolean) => void
  setQuickActionsOpen: (v: boolean) => void
  setNotificationsOpen: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  commandOpen: false,
  quickActionsOpen: false,
  notificationsOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
  setCommandOpen: (v) => set({ commandOpen: v }),
  setQuickActionsOpen: (v) => set({ quickActionsOpen: v }),
  setNotificationsOpen: (v) => set({ notificationsOpen: v }),
}))
