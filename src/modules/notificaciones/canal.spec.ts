import { elegirCanales } from './canal';
import { textoRecordatorio } from './plantillas';

const todos = { push: true, whatsapp: true, sms: true, email: true };
const contacto = {
  canalPreferido: null,
  tieneApp: true,
  telefono: '+573001112233',
  email: 'a@b.co',
};

describe('elección de canal (§9.5)', () => {
  it('sin preferencia: push, WhatsApp, SMS, email', () => {
    expect(elegirCanales(contacto, todos)).toEqual(['PUSH', 'WHATSAPP', 'SMS', 'EMAIL']);
  });

  it('la preferencia va primero si se puede usar', () => {
    expect(elegirCanales({ ...contacto, canalPreferido: 'EMAIL' }, todos)[0]).toBe('EMAIL');
  });

  it('ignora la preferencia si no hay forma de usarla', () => {
    const sinTelefono = { ...contacto, telefono: null, canalPreferido: 'WHATSAPP' as const };
    expect(elegirCanales(sinTelefono, todos)).toEqual(['PUSH', 'EMAIL']);
  });

  it('sin app ni proveedores de mensajería, solo email', () => {
    expect(
      elegirCanales(
        { ...contacto, tieneApp: false },
        { push: true, whatsapp: false, sms: false, email: true },
      ),
    ).toEqual(['EMAIL']);
  });
});

describe('plantilla del recordatorio', () => {
  it('usa "mañana" y la hora local de la clínica', () => {
    const texto = textoRecordatorio({
      nombre: 'Ana',
      medico: 'Dra. Laura Méndez',
      especialidad: 'Medicina general',
      clinica: 'Clínica Demo',
      inicio: new Date('2026-10-05T14:30:00Z'),
      zonaHoraria: 'America/Bogota',
      enlace: 'https://app/c/abc',
      ahora: new Date('2026-10-04T15:00:00Z'),
    });
    expect(texto).toContain(
      'Hola Ana, te recordamos tu cita con Dra. Laura Méndez (Medicina general) mañana',
    );
    expect(texto).toMatch(/9:30/);
    expect(texto).toContain('Confirma o cancela aquí: https://app/c/abc');
  });
});
