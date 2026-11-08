// ═══════════════════════════════════════════════════════════
// app/(tabs)/_layout.tsx — Navegación por pestañas
// 4 pestañas principales y rutas secundarias ocultas del tab bar
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, Text, StyleSheet } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }): React.JSX.Element {
  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E0E0E0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="hoy"
        options={{
          title: 'Asistencia',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📋" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="trabajadores/index"
        options={{
          title: 'Trabajadores',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🧑‍🌾" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cosecha/index"
        options={{
          title: 'Cosecha',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🌽" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reportes/index"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="resumen"
        options={{
          title: 'Resumen',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📈" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="instalar"
        options={{
          href: null,
        }}
      />

      {/* Rutas secundarias (detalle y subpantallas) ocultas de la barra */}
      <Tabs.Screen
        name="trabajadores/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="cosecha/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="reportes/exportar"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 22,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
  },
});
