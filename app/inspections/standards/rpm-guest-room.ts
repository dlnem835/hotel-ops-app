import { L, stdCategory, stdItem } from "./builders";
import { StandardTemplateDefinition } from "./types";

export const RPM_GUEST_ROOM: StandardTemplateDefinition = {
  key: "rpm-guest-room",
  version: "1.0",
  name: "RPM Guest Room",
  templateType: "RPM",
  description: "Routine preventative maintenance inspection for guest rooms.",
  categories: [
    stdCategory("entry", L("Entry", "Entrada"), [
      stdItem(
        "door-lock",
        L(
          "Door Lock: Is the entry door lock clean and in good condition with a solid green light when a key is used?",
          "Cerradura: ¿Está limpia y en buen estado con luz verde sólida al usar la llave?"
        ),
        2
      ),
      stdItem(
        "door-latch",
        L(
          "Door Latch, Peephole and Door Frame: Is the entry door, latch, peephole and door frame secure, clean and in good condition?",
          "Pestillo, mirilla y marco: ¿Puerta, pestillo, mirilla y marco seguros, limpios y en buen estado?"
        ),
        2
      ),
      stdItem(
        "odor",
        L(
          "Odor: Is the room free of odors?",
          "Olor: ¿La habitación está libre de olores?"
        ),
        5
      ),
    ]),
    stdCategory("bath", L("Bath", "Baño"), [
      stdItem(
        "faucets-shower",
        L(
          "Faucets/Shower: Is the bathroom sink faucet and tub spout secure and in good condition?",
          "Grifos/Ducha: ¿Grifo del lavabo y tubo de la tina seguros y en buen estado?"
        ),
        2
      ),
      stdItem(
        "bath-doors",
        L(
          "Bath Doors: Are the bathroom door and door frame clean and in good condition?",
          "Puertas del baño: ¿Puerta y marco del baño limpios y en buen estado?"
        ),
        2
      ),
      stdItem(
        "shower-doors",
        L(
          "Shower Doors/Curtains: Are the bathroom shower doors or shower curtain secure, clean and in good condition?",
          "Puertas/Cortina de ducha: ¿Seguras, limpias y en buen estado?"
        ),
        5
      ),
      stdItem(
        "drains-odor",
        L(
          "Drains/Odor: Are all the drains in the bathroom clear and free of odor?",
          "Desagües/Olor: ¿Todos los desagües despejados y sin olor?"
        ),
        5
      ),
      stdItem(
        "caulking",
        L(
          "Caulking: Is the shower/tub and toilet caulking clean and in good condition?",
          "Sellador: ¿Sellador de ducha/tina e inodoro limpio y en buen estado?"
        ),
        10
      ),
      stdItem(
        "toilet",
        L(
          "Toilet: Is the toilet bowl, tank, seat, and handle clean, secure and in good condition?",
          "Inodoro: ¿Taza, tanque, asiento y palanca limpios, seguros y en buen estado?"
        ),
        4
      ),
    ]),
    stdCategory("bedroom", L("Bedroom", "Dormitorio"), [
      stdItem(
        "hvac",
        L(
          "HVAC: Is the thermostat functioning and the air filter clean?",
          "HVAC: ¿Termostato funcionando y filtro de aire limpio?"
        ),
        5
      ),
      stdItem(
        "windows",
        L(
          "Windows/Screens: Are windows operational with intact screens and clean tracks?",
          "Ventanas/Mallas: ¿Ventanas operativas con mallas intactas y rieles limpios?"
        ),
        3
      ),
      stdItem(
        "furniture",
        L(
          "Furniture: Are dressers, chairs, and desk secure with no damage or missing hardware?",
          "Muebles: ¿Cómodas, sillas y escritorio seguros sin daños ni hardware faltante?"
        ),
        3
      ),
      stdItem(
        "electrical",
        L(
          "Electrical: Do all outlets, switches, and lamps work properly?",
          "Eléctrico: ¿Todos los tomacorrientes, interruptores y lámparas funcionan?"
        ),
        5
      ),
      stdItem(
        "tv-phone",
        L(
          "TV/Phone: Are TV, remote, and phone operational?",
          "TV/Teléfono: ¿TV, control y teléfono operativos?"
        ),
        3
      ),
      stdItem(
        "ceiling-walls",
        L(
          "Ceiling/Walls: Are ceiling, walls, and baseboards free of damage or water stains?",
          "Techo/Paredes: ¿Techo, paredes y zócalos sin daños ni manchas de agua?"
        ),
        3
      ),
    ]),
    stdCategory("closet", L("Closet", "Closet"), [
      stdItem(
        "safe",
        L(
          "Safe: Is the in-room safe clean, operational, and reset?",
          "Caja fuerte: ¿Limpia, operativa y restablecida?"
        ),
        3
      ),
      stdItem(
        "iron-board",
        L(
          "Iron/Ironing Board: Are the iron and ironing board clean and in good condition?",
          "Plancha/Tabla: ¿Plancha y tabla limpias y en buen estado?"
        ),
        2
      ),
      stdItem(
        "hangers-rack",
        L(
          "Hangers/Luggage Rack: Are hangers and luggage rack present and undamaged?",
          "Ganchos/Rack de equipaje: ¿Presentes y sin daños?"
        ),
        2
      ),
      stdItem(
        "closet-door",
        L(
          "Closet Door/Hardware: Does the closet door operate smoothly with intact hardware?",
          "Puerta del closet: ¿Opera suavemente con hardware intacto?"
        ),
        2
      ),
    ]),
  ],
};
