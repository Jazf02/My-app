// ═══════════════════════════════════════════════════════════
// app/(auth)/primer-uso.tsx — Redirección a Login oficial
// ═══════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';

export default function PrimerUsoScreen(): React.JSX.Element {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(auth)/login');
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#2E7D32" />
    </SafeAreaView>
  );
}
