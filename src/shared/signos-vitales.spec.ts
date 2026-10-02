import { calcularAlertas, calcularImc, SignosVitalesEntrada } from './signos-vitales';

describe('signos vitales (§8.4)', () => {
  describe('rangos aceptados', () => {
    const casos: [string, Record<string, number>, boolean][] = [
      ['presión en rango', { presionSistolica: 120, presionDiastolica: 80 }, true],
      ['sistólica bajo 50', { presionSistolica: 49, presionDiastolica: 30 }, false],
      ['diastólica sobre 160', { presionSistolica: 250, presionDiastolica: 161 }, false],
      ['sistólica ≤ diastólica', { presionSistolica: 80, presionDiastolica: 90 }, false],
      ['solo sistólica', { presionSistolica: 120 }, false],
      ['FC 30', { frecuenciaCardiaca: 30 }, true],
      ['FC 221', { frecuenciaCardiaca: 221 }, false],
      ['temperatura 42.5', { temperatura: 42.5 }, true],
      ['temperatura 33.9', { temperatura: 33.9 }, false],
      ['SpO2 101', { spo2: 101 }, false],
      ['peso 0.5', { pesoKg: 0.5 }, true],
      ['talla 251', { tallaCm: 251 }, false],
    ];
    it.each(casos)('%s', (_, datos, valido) => {
      expect(SignosVitalesEntrada.safeParse(datos).success).toBe(valido);
    });
  });

  describe('alertas', () => {
    it('presión ≥ 140/90', () => {
      expect(calcularAlertas({ presionSistolica: 140, presionDiastolica: 85 }, 40)).toContain(
        'PRESION_ALTA',
      );
      expect(calcularAlertas({ presionSistolica: 130, presionDiastolica: 90 }, 40)).toContain(
        'PRESION_ALTA',
      );
      expect(calcularAlertas({ presionSistolica: 139, presionDiastolica: 89 }, 40)).not.toContain(
        'PRESION_ALTA',
      );
    });

    it('taquicardia > 100 solo en mayores de 12 años', () => {
      expect(calcularAlertas({ frecuenciaCardiaca: 101 }, 13)).toContain('TAQUICARDIA');
      expect(calcularAlertas({ frecuenciaCardiaca: 100 }, 30)).not.toContain('TAQUICARDIA');
      expect(calcularAlertas({ frecuenciaCardiaca: 120 }, 12)).not.toContain('TAQUICARDIA');
    });

    it('fiebre ≥ 38.0 y saturación < 94', () => {
      expect(calcularAlertas({ temperatura: 38.0, spo2: 93 }, 30)).toEqual([
        'FIEBRE',
        'SATURACION_BAJA',
      ]);
      expect(calcularAlertas({ temperatura: 37.9, spo2: 94 }, 30)).toEqual([]);
    });
  });

  it('IMC con un decimal', () => {
    expect(calcularImc(72.5, 168)).toBe(25.7);
    expect(calcularImc(undefined, 168)).toBeNull();
  });
});
