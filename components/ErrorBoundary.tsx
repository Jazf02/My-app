// ═══════════════════════════════════════════════════════════
// components/ErrorBoundary.tsx — Error boundary global
// Captura cualquier crash de React y muestra pantalla amigable.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * ErrorBoundary global que atrapa errores de renderizado.
 * Muestra "Algo salió mal" al usuario y loguea el error a consola.
 * El error real NUNCA se muestra al usuario (seguridad).
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log para desarrollo/debugging. NUNCA exponer al usuario.
    console.error('[ErrorBoundary] Error capturado:', error);
    console.error('[ErrorBoundary] Info de componente:', info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={styles.titulo}>Algo salió mal</Text>
            <Text style={styles.subtitulo}>
              La aplicación encontró un error inesperado.{'\n'}
              Por favor, inténtalo de nuevo.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.boton,
                pressed && styles.botonPresionado,
              ]}
              onPress={this.handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Reintentar"
              id="error-boundary-retry-btn"
            >
              <Text style={styles.botonTexto}>Reintentar</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 16,
    color: '#616161',
    textAlign: 'center',
    lineHeight: 24,
  },
  boton: {
    marginTop: 16,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPresionado: {
    opacity: 0.8,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
