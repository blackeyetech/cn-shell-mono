export const NetboxApi: { [key: string]: any } = {
  circuits: {
    _choices: "/api/circuits/_choices/",
    providers: "/api/circuits/providers/",
    "circuit-types": "/api/circuits/circuit-types/",
    circuits: "/api/circuits/circuits/",
    "circuit-terminations": "/api/circuits/circuit-terminations/",
  },

  dcim: {
    _choices: "/api/dcim/_choices/",
    regions: "/api/dcim/regions/",
    sites: "/api/dcim/sites/",
    "rack-groups": "/api/dcim/rack-groups/",
    "rack-roles": "/api/dcim/rack-roles/",
    racks: "/api/dcim/racks/",
    "rack-reservations": "/api/dcim/rack-reservations/",
    manufacturers: "/api/dcim/manufacturers/",
    "device-types": "/api/dcim/device-types/",
    "console-port-templates": "/api/dcim/console-port-templates/",
    "console-server-port-templates": "/api/dcim/console-server-port-templates/",
    "power-port-templates": "/api/dcim/power-port-templates/",
    "power-outlet-templates": "/api/dcim/power-outlet-templates/",
    "interface-templates": "/api/dcim/interface-templates/",
    "device-bay-templates": "/api/dcim/device-bay-templates/",
    "device-roles": "/api/dcim/device-roles/",
    platforms: "/api/dcim/platforms/",
    devices: "/api/dcim/devices/",
    "console-ports": "/api/dcim/console-ports/",
    "console-server-ports": "/api/dcim/console-server-ports/",
    "power-ports": "/api/dcim/power-ports/",
    "power-outlets": "/api/dcim/power-outlets/",
    interfaces: "/api/dcim/interfaces/",
    "device-bays": "/api/dcim/device-bays/",
    "inventory-items": "/api/dcim/inventory-items/",
    "console-connections": "/api/dcim/console-connections/",
    "power-connections": "/api/dcim/power-connections/",
    "interface-connections": "/api/dcim/interface-connections/",
    "virtual-chassis": "/api/dcim/virtual-chassis/",
    "connected-device": "/api/dcim/connected-device/",
  },

  extras: {
    _choices: "/api/extras/_choices/",
    graphs: "/api/extras/graphs/",
    "export-templates": "/api/extras/export-templates/",
    "topology-maps": "/api/extras/topology-maps/",
    "image-attachments": "/api/extras/image-attachments/",
    reports: "/api/extras/reports/",
    "recent-activity": "/api/extras/recent-activity/",
  },

  ipam: {
    _choices: "/api/ipam/_choices/",
    vrfs: "/api/ipam/vrfs/",
    rirs: "/api/ipam/rirs/",
    aggregates: "/api/ipam/aggregates/",
    roles: "/api/ipam/roles/",
    prefixes: "/api/ipam/prefixes/",
    "ip-addresses": "/api/ipam/ip-addresses/",
    "vlan-groups": "/api/ipam/vlan-groups/",
    vlans: "/api/ipam/vlans/",
    services: "/api/ipam/services/",
  },

  secrets: {
    _choices: "/api/secrets/_choices/",
    "secret-roles": "/api/secrets/secret-roles/",
    secrets: "/api/secrets/secrets/",
    "get-session-key": "/api/secrets/get-session-key/",
    "generate-rsa-key-pair": "/api/secrets/generate-rsa-key-pair/",
  },

  tenancy: {
    _choices: "/api/tenancy/_choices/",
    "tenant-groups": "/api/tenancy/tenant-groups/",
    tenants: "/api/tenancy/tenants/",
  },

  virtualization: {
    _choices: "/api/virtualization/_choices/",
    "cluster-types": "/api/virtualization/cluster-types/",
    "cluster-groups": "/api/virtualization/cluster-groups/",
    clusters: "/api/virtualization/clusters/",
    "virtual-machines": "/api/virtualization/virtual-machines/",
    interfaces: "/api/virtualization/interfaces/",
  },
};