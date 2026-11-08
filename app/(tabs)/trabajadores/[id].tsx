// app/(tabs)/trabajadores/[id].tsx - MEJORA 3
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { BannerEstado } from "@/components/ui/BannerEstado";
import { obtenerTrabajadorPorId, actualizarTrabajador, eliminarTrabajador } from "@/database/trabajadores";
import { obtenerOCrearSemanaActual, obtenerAsistenciaSemanal, obtenerAdelantosSemana, marcarAsistencia, registrarAdelanto, revertirAdelanto, obtenerResumenTrabajadorSemana } from "@/database/asistencia";
import { formatearFechaCorta, formatearMoneda, DIAS_SEMANA, fechaToISO, hoyISO } from "@/lib/fechas";
import type { Trabajador, Semana, DiaTrabajado, Adelanto } from "@/types/domain";
import type { ResultadoPagoSemanal } from "@/lib/calculos";

export default function TrabajadorDetalleScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trabajador, setTrabajador] = useState<Trabajador | null>(null);
  const [semana, setSemana] = useState<Semana | null>(null);
  const [diasTrabajados, setDiasTrabajados] = useState<DiaTrabajado[]>([]);
  const [adelantos, setAdelantos] = useState<Adelanto[]>([]);
  const [resumen, setResumen] = useState<ResultadoPagoSemanal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editandoAsistencia, setEditandoAsistencia] = useState(false);
  const [modalTarifaVisible, setModalTarifaVisible] = useState(false);
  const [tarifaBaseInput, setTarifaBaseInput] = useState("");
  const [guardandoTarifa, setGuardandoTarifa] = useState(false);
  const [modalAdelantoVisible, setModalAdelantoVisible] = useState(false);
  const [montoAdelanto, setMontoAdelanto] = useState("");
  const [conceptoAdelanto, setConceptoAdelanto] = useState("");
  const [fechaAdelantoInput, setFechaAdelantoInput] = useState(hoyISO());
  const [guardandoAdelanto, setGuardandoAdelanto] = useState(false);
  const [errorAdelanto, setErrorAdelanto] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!id) return;
    try {
      setCargando(true);
      const t = await obtenerTrabajadorPorId(id);
      if (!t) { Alert.alert("Error", "Trabajador no encontrado."); router.back(); return; }
      setTrabajador(t);
      const sem = await obtenerOCrearSemanaActual();
      setSemana(sem);
      setDiasTrabajados(await obtenerAsistenciaSemanal(sem.id, t.id));
      setAdelantos(await obtenerAdelantosSemana(sem.id, t.id));
      setResumen(await obtenerResumenTrabajadorSemana(sem.id, t));
    } catch (err) { console.error("[DetalleTrabajador] Error:", err); }
    finally { setCargando(false); }
  }, [id, router]);

  useFocusEffect(useCallback(() => { cargarDatos(); }, [cargarDatos]));

  const handleToggleDia = async (fechaISO: string, presenteActual: boolean) => {
    if (!trabajador || !semana || !editandoAsistencia) return;
    try { await marcarAsistencia({ semanaId: semana.id, trabajadorId: trabajador.id, fecha: fechaISO, presente: !presenteActual }); await cargarDatos(); }
    catch (err) { console.error(err); }
  };

  const handleToggleDominical = async (valor: boolean) => {
    if (!trabajador) return;
    try { await actualizarTrabajador(trabajador.id, { dominical: valor ? 1 : 0 }); await cargarDatos(); }
    catch (err) { console.error(err); }
  };

  const handleGuardarTarifaBase = async () => {
    if (!trabajador) return;
    const tarifa = parseFloat(tarifaBaseInput.replace(",", "."));
    if (isNaN(tarifa) || tarifa <= 0) { Alert.alert("Error", "Ingresa una tarifa valida."); return; }
    try { setGuardandoTarifa(true); await actualizarTrabajador(trabajador.id, { tarifa_diaria_default: tarifa }); setModalTarifaVisible(false); await cargarDatos(); }
    catch (err) { console.error(err); } finally { setGuardandoTarifa(false); }
  };

  const handleGuardarAdelanto = async () => {
    if (!trabajador || !semana) return;
    const monto = parseFloat(montoAdelanto.replace(",", "."));
    if (isNaN(monto) || monto <= 0) { setErrorAdelanto("Ingresa un monto valido mayor a 0."); return; }
    if (!fechaAdelantoInput) { setErrorAdelanto("La fecha es obligatoria."); return; }
    try {
      setGuardandoAdelanto(true); setErrorAdelanto(null);
      await registrarAdelanto({ semana_id: semana.id, trabajador_id: trabajador.id, monto, concepto: conceptoAdelanto.trim() || "Adelanto", fecha: fechaAdelantoInput });
      setModalAdelantoVisible(false); setMontoAdelanto(""); setConceptoAdelanto(""); setFechaAdelantoInput(hoyISO());
      await cargarDatos();
    } catch (err: unknown) { setErrorAdelanto(err instanceof Error ? err.message : "Error al registrar adelanto."); }
    finally { setGuardandoAdelanto(false); }
  };

  const handleRevertirAdelanto = (adelantoId: string, monto: number) => {
    Alert.alert(
      "Revertir Adelanto",
      `¿Deseas revertir este adelanto de ${formatearMoneda(monto)}? Ya no se restará del total a pagar.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revertir",
          style: "destructive",
          onPress: async () => {
            try {
              await revertirAdelanto(adelantoId);
              await cargarDatos();
            } catch (err) {
              Alert.alert("Error", "No se pudo revertir el adelanto.");
            }
          },
        },
      ]
    );
  };

  const diasSemanaArray = React.useMemo(() => {
    if (!semana) return [];
    const lunes = new Date(semana.fecha_inicio + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes.getTime()); d.setDate(lunes.getDate() + i);
      const iso = fechaToISO(d);
      const reg = diasTrabajados.find((r) => r.fecha === iso);
      return { nombreDia: DIAS_SEMANA[i], fechaISO: iso, presente: Boolean(reg && reg.presente === 1) };
    });
  }, [semana, diasTrabajados]);

  if (cargando || !trabajador) {
    return (<SafeAreaView style={s.safe}><View style={s.centro}><ActivityIndicator size="large" color="#2E7D32" /></View></SafeAreaView>);
  }

  return (
    <SafeAreaView style={s.safe}>
      <BannerEstado />
      <View style={s.header}>
        <Pressable style={s.btnVolver} onPress={() => router.back()} hitSlop={10}><Text style={s.btnVolverTexto}>Volver</Text></Pressable>
        <Text style={s.headerTitulo} numberOfLines={1}>{trabajador.nombre}</Text>
      </View>
      <ScrollView contentContainerStyle={s.contenido}>
        <View style={s.tarjetaPerfil}>
          <View style={s.avatarGrande}><Text style={s.avatarGrandeEmoji}>🧑‍🌾</Text></View>
          <View style={s.infoPerfil}>
            <Text style={s.nombrePerfil}>{trabajador.nombre}</Text>
            <Pressable style={s.filaTarifa} onPress={() => { setTarifaBaseInput(String(trabajador.tarifa_diaria_default || 250)); setModalTarifaVisible(true); }}>
              <Text style={s.tarifaTexto}>Tarifa base: <Text style={s.tarifaBold}>{formatearMoneda(trabajador.tarifa_diaria_default || 250)}</Text>/dia</Text>
              <Text>  ✏️</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.tarjetaDominical}>
          <View style={s.infoDominical}>
            <Text style={s.dominicalTitulo}>Habilitado para domingos</Text>
            <Text style={s.dominicalSub}>Aparece en lista de asistencia dominical con pago manual</Text>
          </View>
          <Switch value={Boolean(trabajador.dominical)} onValueChange={handleToggleDominical} trackColor={{ false: "#E5E7EB", true: "#86EFAC" }} thumbColor={Boolean(trabajador.dominical) ? "#2E7D32" : "#9CA3AF"} />
        </View>

        {resumen && semana && (
          <View style={s.tarjetaResumen}>
            <Text style={s.semanaLabel}>Semana: {formatearFechaCorta(semana.fecha_inicio)} - {formatearFechaCorta(semana.fecha_fin)}</Text>
            <View style={s.gridResumen}>
              <View style={s.itemResumen}><Text style={s.itemNum}>{resumen.diasPresentes}</Text><Text style={s.itemLabel}>Dias</Text></View>
              <View style={s.itemResumen}><Text style={s.itemNum}>{formatearMoneda(resumen.totalGanado)}</Text><Text style={s.itemLabel}>Ganado</Text></View>
              <View style={s.itemResumen}><Text style={[s.itemNum, s.rojo]}>{formatearMoneda(resumen.totalAdelantos)}</Text><Text style={s.itemLabel}>Adelantos</Text></View>
            </View>
            <View style={s.bannerNeto}><Text style={s.netoLabel}>Neto a pagar</Text><Text style={s.netoMonto}>{formatearMoneda(resumen.totalAPagar)}</Text></View>
          </View>
        )}

        <View style={s.seccion}>
          <View style={s.filaHeader}>
            <View>
              <Text style={s.seccionTitulo}>Asistencia de la Semana</Text>
              {!editandoAsistencia && <Text style={s.seccionSub}>Solo lectura</Text>}
            </View>
            {!editandoAsistencia
              ? <Pressable style={s.btnEditar} onPress={() => setEditandoAsistencia(true)}><Text style={s.btnEditarTexto}>Editar asistencia</Text></Pressable>
              : <Pressable style={s.btnGuardar2} onPress={() => setEditandoAsistencia(false)}><Text style={s.btnGuardar2Texto}>Guardar</Text></Pressable>
            }
          </View>
          <View style={s.listaDias}>
            {diasSemanaArray.map((dia) => (
              <Pressable key={dia.fechaISO}
                style={[s.filaDia, dia.presente && s.filaDiaOk, !editandoAsistencia && s.filaDiaLock]}
                onPress={() => handleToggleDia(dia.fechaISO, dia.presente)} disabled={!editandoAsistencia}>
                <View><Text style={[s.diaNombre, dia.presente && s.diaNombreOk]}>{dia.nombreDia}</Text><Text style={s.diaFecha}>{formatearFechaCorta(dia.fechaISO)}</Text></View>
                <View style={[s.badge, dia.presente && s.badgeOk]}><Text style={[s.badgeTexto, dia.presente && s.badgeTextoOk]}>{dia.presente ? "Presente" : "Ausente"}</Text></View>
              </Pressable>
            ))}
          </View>
          {editandoAsistencia && <View style={s.avisoEdit}><Text style={s.avisoEditTexto}>Modo edicion — toca un dia para cambiar</Text></View>}
        </View>

        <View style={s.seccion}>
          <View style={s.filaHeader}>
            <Text style={s.seccionTitulo}>Adelantos Registrados</Text>
            <Pressable style={s.btnAdelanto} onPress={() => { setErrorAdelanto(null); setMontoAdelanto(""); setConceptoAdelanto(""); setFechaAdelantoInput(hoyISO()); setModalAdelantoVisible(true); }}>
              <Text style={s.btnAdelantoTexto}>+ Adelanto</Text>
            </Pressable>
          </View>
          {adelantos.length === 0
            ? <View style={s.vacio}><Text style={s.vacioTexto}>No hay adelantos esta semana.</Text></View>
            : <View style={s.listaAdel}>{adelantos.map((ad) => {
                const esRevertido = ad.revertido === 1;
                return (
                  <View key={ad.id} style={[s.itemAdel, esRevertido && s.itemAdelRevertido]}>
                    <View style={s.infoAdel}>
                      <Text style={[s.adelCon, esRevertido && s.textoTachado]}>
                        {formatearFechaCorta(ad.fecha)} | {formatearMoneda(ad.monto)} | {ad.concepto || "Sin nota"}
                      </Text>
                      {esRevertido && <Text style={s.badgeRevertido}>Revertido (no cuenta en total)</Text>}
                    </View>
                    {!esRevertido && (
                      <Pressable
                        style={s.btnRevertir}
                        onPress={() => handleRevertirAdelanto(ad.id, ad.monto)}
                      >
                        <Text style={s.btnRevertirTexto}>Revertir</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}</View>
          }
        </View>

        <View style={[s.seccion, s.seccionEliminar]}>
          <Text style={s.eliminarTitulo}>Zona de Administración</Text>
          <Text style={s.eliminarSub}>
            Elimina permanentemente a este trabajador y todos sus registros de asistencia y pagos.
          </Text>
          <Pressable
            style={s.btnEliminarDefinitivo}
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const ok = window.confirm(
                  `¿Estás seguro de que deseas eliminar permanentemente a "${trabajador.nombre}"?\n\nEsta acción no se puede deshacer.`
                );
                if (ok) {
                  eliminarTrabajador(trabajador.id).then(() => {
                    router.replace('/(tabs)/trabajadores');
                  });
                }
                return;
              }

              Alert.alert(
                'Eliminar Trabajador',
                `¿Deseas eliminar permanentemente a "${trabajador.nombre}"?\n\nEsta acción no se puede deshacer.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                      await eliminarTrabajador(trabajador.id);
                      router.replace('/(tabs)/trabajadores');
                    },
                  },
                ]
              );
            }}
          >
            <Text style={s.btnEliminarDefinitivoTexto}>🗑️ Eliminar Trabajador Permanentemente</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={modalTarifaVisible} transparent animationType="slide" onRequestClose={() => setModalTarifaVisible(false)}>
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalTitle}>Tarifa Base Diaria</Text>
          <Text style={s.modalSub}>Para {trabajador.nombre}</Text>
          <TextInput style={s.input} value={tarifaBaseInput} onChangeText={setTarifaBaseInput} keyboardType="numeric" placeholder="250" autoFocus />
          <Text style={s.hint}>En Hoy puedes hacer un override para un dia especifico.</Text>
          <View style={s.modalBtns}>
            <Pressable style={[s.modalBtn, s.btnCancel]} onPress={() => setModalTarifaVisible(false)}><Text style={s.btnCancelText}>Cancelar</Text></Pressable>
            <Pressable style={[s.modalBtn, s.btnSave]} onPress={handleGuardarTarifaBase} disabled={guardandoTarifa}>
              {guardandoTarifa ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.btnSaveText}>Guardar</Text>}
            </Pressable>
          </View>
        </View></View>
      </Modal>

      <Modal visible={modalAdelantoVisible} transparent animationType="slide" onRequestClose={() => setModalAdelantoVisible(false)}>
        <View style={s.overlay}><View style={s.modal}>
          <Text style={s.modalTitle}>Registrar Adelanto</Text>
          <Text style={s.modalSub}>Para {trabajador.nombre}</Text>
          <Text style={s.fieldLabel}>Monto en Lempiras</Text>
          <TextInput style={s.input} placeholder="Ej. 100" placeholderTextColor="#9E9E9E" keyboardType="numeric" value={montoAdelanto} onChangeText={setMontoAdelanto} autoFocus />
          <Text style={s.fieldLabel}>Fecha (YYYY-MM-DD)</Text>
          <TextInput style={s.input} placeholder="2026-10-21" placeholderTextColor="#9E9E9E" value={fechaAdelantoInput} onChangeText={setFechaAdelantoInput} />
          <Text style={s.fieldLabel}>Nota (opcional)</Text>
          <TextInput style={s.input} placeholder="Ej. prestamo herramienta" placeholderTextColor="#9E9E9E" value={conceptoAdelanto} onChangeText={setConceptoAdelanto} />
          {errorAdelanto && <View style={s.errBox}><Text style={s.errText}>{errorAdelanto}</Text></View>}
          <View style={s.modalBtns}>
            <Pressable style={[s.modalBtn, s.btnCancel]} onPress={() => setModalAdelantoVisible(false)}><Text style={s.btnCancelText}>Cancelar</Text></Pressable>
            <Pressable style={[s.modalBtn, s.btnSave]} onPress={handleGuardarAdelanto} disabled={guardandoAdelanto}>
              {guardandoAdelanto ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.btnSaveText}>Guardar</Text>}
            </Pressable>
          </View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F9F7" },
  centro: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E8EBE8", gap: 12 },
  btnVolver: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#E8F5E9" },
  btnVolverTexto: { color: "#2E7D32", fontSize: 14, fontWeight: "700" },
  headerTitulo: { fontSize: 18, fontWeight: "700", color: "#1B381E", flex: 1 },
  contenido: { padding: 16, gap: 16 },
  tarjetaPerfil: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EBE8" },
  avatarGrande: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginRight: 14 },
  avatarGrandeEmoji: { fontSize: 30 },
  infoPerfil: { flex: 1, gap: 4 },
  nombrePerfil: { fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  filaTarifa: { flexDirection: "row", alignItems: "center" },
  tarifaTexto: { fontSize: 14, color: "#71717A" },
  tarifaBold: { color: "#2E7D32", fontWeight: "700" },
  tarjetaDominical: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EBE8" },
  infoDominical: { flex: 1 },
  dominicalTitulo: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  dominicalSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  tarjetaResumen: { backgroundColor: "#FFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EBE8", gap: 10 },
  semanaLabel: { fontSize: 13, color: "#71717A", fontWeight: "600" },
  gridResumen: { flexDirection: "row", backgroundColor: "#F9FAF9", borderRadius: 12, padding: 12 },
  itemResumen: { flex: 1, alignItems: "center" },
  itemNum: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  itemLabel: { fontSize: 12, color: "#71717A", marginTop: 2 },
  rojo: { color: "#DC2626" },
  bannerNeto: { backgroundColor: "#E8F5E9", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  netoLabel: { fontSize: 15, fontWeight: "600", color: "#1B5E20" },
  netoMonto: { fontSize: 22, fontWeight: "800", color: "#1B5E20" },
  seccion: { backgroundColor: "#FFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EBE8", gap: 10 },
  filaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  seccionTitulo: { fontSize: 17, fontWeight: "700", color: "#1A1A1A" },
  seccionSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  btnEditar: { backgroundColor: "#EFF6FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnEditarTexto: { color: "#1D4ED8", fontSize: 13, fontWeight: "700" },
  btnGuardar2: { backgroundColor: "#E8F5E9", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnGuardar2Texto: { color: "#2E7D32", fontSize: 13, fontWeight: "700" },
  listaDias: { gap: 8, marginTop: 4 },
  filaDia: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#F9FAF9", borderWidth: 1, borderColor: "#E5E7EB" },
  filaDiaOk: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  filaDiaLock: { opacity: 0.85 },
  diaNombre: { fontSize: 15, fontWeight: "600", color: "#4B5563" },
  diaNombreOk: { color: "#166534" },
  diaFecha: { fontSize: 12, color: "#9CA3AF" },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#F3F4F6" },
  badgeOk: { backgroundColor: "#DCFCE7" },
  badgeTexto: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  badgeTextoOk: { color: "#15803D" },
  avisoEdit: { backgroundColor: "#FEF3C7", borderRadius: 8, padding: 8 },
  avisoEditTexto: { fontSize: 12, color: "#92400E", fontWeight: "600" },
  btnAdelanto: { backgroundColor: "#2E7D32", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnAdelantoTexto: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  vacio: { paddingVertical: 14, alignItems: "center" },
  vacioTexto: { color: "#9CA3AF", fontSize: 14 },
  listaAdel: { gap: 8 },
  itemAdel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FFEDD5" },
  itemAdelRevertido: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB", opacity: 0.7 },
  infoAdel: { flex: 1, gap: 2, marginRight: 8 },
  adelCon: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },
  textoTachado: { textDecorationLine: "line-through", color: "#9CA3AF" },
  badgeRevertido: { fontSize: 11, color: "#DC2626", fontWeight: "700", marginTop: 2 },
  btnRevertir: { backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: "#FECACA" },
  btnRevertirTexto: { color: "#DC2626", fontSize: 12, fontWeight: "700" },
  adelFecha: { fontSize: 12, color: "#9CA3AF" },
  adelMonto: { fontSize: 15, fontWeight: "700", color: "#C2410C" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: "#FFF", borderRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 22, fontWeight: "700", color: "#1A1A1A" },
  modalSub: { fontSize: 14, color: "#6B7280" },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#1A1A1A", backgroundColor: "#F9FAFB" },
  hint: { fontSize: 12, color: "#9CA3AF" },
  errBox: { backgroundColor: "#FEF2F2", borderLeftWidth: 3, borderLeftColor: "#EF4444", padding: 10, borderRadius: 6 },
  errText: { color: "#B91C1C", fontSize: 13 },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnCancel: { backgroundColor: "#F3F4F6" },
  btnCancelText: { color: "#4B5563", fontSize: 15, fontWeight: "600" },
  btnSave: { backgroundColor: "#2E7D32" },
  btnSaveText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  seccionEliminar: { borderColor: "#FEE2E2", backgroundColor: "#FEF2F2", marginTop: 8 },
  eliminarTitulo: { fontSize: 16, fontWeight: "700", color: "#991B1B" },
  eliminarSub: { fontSize: 13, color: "#7F1D1D", lineHeight: 18 },
  btnEliminarDefinitivo: { backgroundColor: "#DC2626", paddingVertical: 13, borderRadius: 12, alignItems: "center", marginTop: 4 },
  btnEliminarDefinitivoTexto: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});