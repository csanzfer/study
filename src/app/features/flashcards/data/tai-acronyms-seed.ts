import { CreateFlashcardInput, TaiBlockId } from '../../../core/models/study.models';

export interface TaiAcronymSeedItem {
  blockId: TaiBlockId;
  front: string;
  back: string;
  hint?: string;
  extraTags?: string[];
}

export const TAI_ACRONYMS_SEED: TaiAcronymSeedItem[] = [
  // Bloque I — Organización del Estado y Administración Electrónica
  { blockId: 'B1', front: 'ENS', back: 'Esquema Nacional de Seguridad', hint: 'RD 311/2022', extraTags: ['seguridad', 'leyes'] },
  { blockId: 'B1', front: 'ENI', back: 'Esquema Nacional de Interoperabilidad', hint: 'RD 4/2010', extraTags: ['leyes'] },
  { blockId: 'B1', front: 'LPAC', back: 'Ley del Procedimiento Administrativo Común de las Administraciones Públicas', hint: 'Ley 39/2015', extraTags: ['leyes'] },
  { blockId: 'B1', front: 'LRJSP', back: 'Ley de Régimen Jurídico del Sector Público', hint: 'Ley 40/2015', extraTags: ['leyes'] },
  { blockId: 'B1', front: 'RGPD', back: 'Reglamento General de Protección de Datos', hint: 'Reglamento (UE) 2016/679', extraTags: ['leyes', 'seguridad'] },
  { blockId: 'B1', front: 'LOPDGDD', back: 'Ley Orgánica de Protección de Datos Personales y garantía de los derechos digitales', hint: 'LO 3/2018', extraTags: ['leyes'] },
  { blockId: 'B1', front: 'TREBEP', back: 'Texto Refundido de la Ley del Estatuto Básico del Empleado Público', hint: 'RDL 5/2015', extraTags: ['leyes'] },
  { blockId: 'B1', front: 'LCSP', back: 'Ley de Contratos del Sector Público', hint: 'Ley 9/2017', extraTags: ['leyes'] },
  { blockId: 'B1', front: 'SGAD', back: 'Secretaría General de Administración Digital', hint: 'Órgano directivo TIC de la AGE' },
  { blockId: 'B1', front: 'CCN-CERT', back: 'Centro Criptológico Nacional — Computer Emergency Response Team', hint: 'Capacidad de respuesta ante incidentes en el sector público', extraTags: ['seguridad'] },

  // Bloque II — Tecnología Básica
  { blockId: 'B2', front: 'ALU', back: 'Arithmetic Logic Unit (Unidad Aritmético-Lógica)', hint: 'Componente central de la CPU' },
  { blockId: 'B2', front: 'RISC', back: 'Reduced Instruction Set Computer', hint: 'Arquitectura con instrucciones simples y tamaño fijo (ej. ARM)' },
  { blockId: 'B2', front: 'CISC', back: 'Complex Instruction Set Computer', hint: 'Arquitectura con repertorio amplio y longitud variable (ej. x86)' },
  { blockId: 'B2', front: 'DMA', back: 'Direct Memory Access (Acceso Directo a Memoria)', hint: 'Transferencia periférico-RAM sin intervención continua de CPU' },
  { blockId: 'B2', front: 'UEFI', back: 'Unified Extensible Firmware Interface', hint: 'Sustituto moderno de la BIOS con soporte GPT y Secure Boot' },
  { blockId: 'B2', front: 'RAID', back: 'Redundant Array of Independent Disks', hint: 'RAID 0 (striping), 1 (mirror), 5 (paridad distribuida), 10' },
  { blockId: 'B2', front: 'NVMe', back: 'Non-Volatile Memory Express', hint: 'Protocolo de almacenamiento sobre PCIe para SSD' },
  { blockId: 'B2', front: 'MMU', back: 'Memory Management Unit (Unidad de Gestión de Memoria)', hint: 'Traduce direcciones virtuales a físicas (TLB)' },
  { blockId: 'B2', front: 'NUMA', back: 'Non-Uniform Memory Access', hint: 'Arquitectura multiprocesador con memoria local y remota' },
  { blockId: 'B2', front: 'POSIX', back: 'Portable Operating System Interface', hint: 'Estándar IEEE de compatibilidad entre sistemas tipo UNIX' },

  // Bloque III — Desarrollo de Sistemas
  { blockId: 'B3', front: 'ACID', back: 'Atomicity, Consistency, Isolation, Durability', hint: 'Propiedades de las transacciones en SGBD relacionales', extraTags: ['sql'] },
  { blockId: 'B3', front: 'CRUD', back: 'Create, Read, Update, Delete', hint: 'Operaciones básicas sobre persistencia / APIs' },
  { blockId: 'B3', front: 'ORM', back: 'Object-Relational Mapping', hint: 'Mapeo entre objetos y tablas relacionales (ej. Hibernate, JPA)' },
  { blockId: 'B3', front: 'REST', back: 'Representational State Transfer', hint: 'Estilo arquitectónico sobre HTTP sin estado' },
  { blockId: 'B3', front: 'SOAP', back: 'Simple Object Access Protocol', hint: 'Protocolo de servicios web basado en XML y WSDL' },
  { blockId: 'B3', front: 'SOLID', back: 'Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion', hint: 'Principios de diseño orientado a objetos' },
  { blockId: 'B3', front: 'OWASP', back: 'Open Worldwide Application Security Project', hint: 'Referente en vulnerabilidades web (Top 10: XSS, SQLi, CSRF...)', extraTags: ['seguridad'] },
  { blockId: 'B3', front: 'WCAG', back: 'Web Content Accessibility Guidelines', hint: 'Pautas de accesibilidad web del W3C (niveles A, AA, AAA)' },
  { blockId: 'B3', front: 'UML', back: 'Unified Modeling Language', hint: 'Diagramas estructurales (clases, componentes) y de comportamiento (secuencia, casos de uso)' },
  { blockId: 'B3', front: 'CI/CD', back: 'Continuous Integration / Continuous Delivery (or Deployment)', hint: 'Automatización de compilación, pruebas y despliegue' },
  { blockId: 'B3', front: 'DDL / DML', back: 'Data Definition Language / Data Manipulation Language', hint: 'CREATE/ALTER/DROP frente a SELECT/INSERT/UPDATE/DELETE', extraTags: ['sql'] },

  // Bloque IV — Sistemas y Comunicaciones
  { blockId: 'B4', front: 'OSI', back: 'Open Systems Interconnection', hint: 'Modelo de referencia de 7 capas (Física a Aplicación)', extraTags: ['protocolos'] },
  { blockId: 'B4', front: 'DNS', back: 'Domain Name System', hint: 'Puerto 53 UDP/TCP · Resolución de nombres de dominio', extraTags: ['puertos', 'protocolos'] },
  { blockId: 'B4', front: 'DHCP', back: 'Dynamic Host Configuration Protocol', hint: 'Puertos 67/68 UDP · Asignación dinámica de IP (DORA)', extraTags: ['puertos', 'protocolos'] },
  { blockId: 'B4', front: 'BGP', back: 'Border Gateway Protocol', hint: 'Puerto 179 TCP · Enrutamiento exterior (EGP) entre Sistemas Autónomos', extraTags: ['puertos', 'protocolos'] },
  { blockId: 'B4', front: 'OSPF', back: 'Open Shortest Path First', hint: 'Protocolo de enrutamiento interior (IGP) de estado de enlace (Dijkstra)', extraTags: ['protocolos'] },
  { blockId: 'B4', front: 'NAT', back: 'Network Address Translation', hint: 'Traduce direcciones IP privadas a públicas (RFC 1918)' },
  { blockId: 'B4', front: 'VLAN', back: 'Virtual Local Area Network', hint: 'Estándar IEEE 802.1Q · Segmentación lógica en capa 2' },
  { blockId: 'B4', front: 'TLS', back: 'Transport Layer Security', hint: 'Cifrado en transporte (HTTPS puerto 443, sucesor de SSL)', extraTags: ['seguridad', 'puertos'] },
  { blockId: 'B4', front: 'IPSec', back: 'Internet Protocol Security', hint: 'Seguridad en capa 3 (AH y ESP, modo transporte y túnel)', extraTags: ['seguridad', 'protocolos'] },
  { blockId: 'B4', front: 'SNMP', back: 'Simple Network Management Protocol', hint: 'Puertos 161/162 UDP · Monitorización y gestión de red', extraTags: ['puertos', 'protocolos'] },
  { blockId: 'B4', front: 'LDAP', back: 'Lightweight Directory Access Protocol', hint: 'Puerto 389 (LDAPS 636) · Acceso a servicios de directorio', extraTags: ['puertos', 'protocolos'] },
  { blockId: 'B4', front: 'SIEM', back: 'Security Information and Event Management', hint: 'Correlación y análisis centralizado de eventos de seguridad', extraTags: ['seguridad'] },
  { blockId: 'B4', front: 'IDS / IPS', back: 'Intrusion Detection System / Intrusion Prevention System', hint: 'Detección pasiva frente a bloqueo activo de intrusiones', extraTags: ['seguridad'] },
  { blockId: 'B4', front: 'DMZ', back: 'Demilitarized Zone (Zona Desmilitarizada)', hint: 'Subred perimetral aislada para servicios expuestos a Internet', extraTags: ['seguridad'] },
];

export function toAcronymFlashcardInput(item: TaiAcronymSeedItem): CreateFlashcardInput {
  return {
    blockId: item.blockId,
    front: item.front,
    back: item.back,
    hint: item.hint,
    tags: Array.from(new Set(['siglas', ...(item.extraTags ?? [])])),
  };
}
