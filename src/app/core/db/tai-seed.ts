import { TaiBlock } from '../models/study.models';

export const TAI_BLOCKS_SEED: TaiBlock[] = [
  {
    id: 'B1',
    code: 'Bloque I',
    title: 'Organización del Estado y Administración Electrónica',
    shortTitle: 'Organización y Adm. Electrónica',
    description:
      'Constitución Española, Ley 39/2015, Ley 40/2015, ENS, ENI, protección de datos, transparencia e igualdad.',
    color: '#2563eb',
    icon: 'account_balance',
    order: 1,
  },
  {
    id: 'B2',
    code: 'Bloque II',
    title: 'Tecnología Básica',
    shortTitle: 'Tecnología Básica',
    description:
      'Arquitectura de ordenadores, sistemas operativos, sistemas de archivos, estructuras de datos y bases de datos.',
    color: '#0891b2',
    icon: 'memory',
    order: 2,
  },
  {
    id: 'B3',
    code: 'Bloque III',
    title: 'Desarrollo de Sistemas',
    shortTitle: 'Desarrollo de Sistemas',
    description:
      'Ingeniería del software, UML, diseño web, programación, accesibilidad, testing, CI/CD y seguridad en desarrollo.',
    color: '#7c3aed',
    icon: 'code',
    order: 3,
  },
  {
    id: 'B4',
    code: 'Bloque IV',
    title: 'Sistemas y Comunicaciones',
    shortTitle: 'Sistemas y Comunicaciones',
    description:
      'Redes TCP/IP, modelo OSI, administración Linux y Windows, virtualización, servicios de red y ciberseguridad.',
    color: '#059669',
    icon: 'lan',
    order: 4,
  },
];
