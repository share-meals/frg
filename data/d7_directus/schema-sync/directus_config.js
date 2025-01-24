/**
 * This file contains the default configuration for the schema exporter.
 * 
 * Some possibly sensitive collections are commented out, remove the comments and add filters if needed
 * 
 * Uncomment the collection you want to export.
 * 
 * These are just some sensible settings, but you might not want to export everything
 * 
 * Add custom collections to the syncCustomCollections object in the config.js file.
 */
export const syncDirectusCollections = {
    directus_folders: {
	watch: ['folders'],
	linkedFields: ['parent']
    },
    directus_files: {
	watch: ['files'],
	query: {
	    filter: {
		storage: {
		    _eq: 'local',
		},
	    }
	},
    },
    directus_roles: {
	watch: ['roles'],
	linkedFields: ['parent']
    },
    directus_policies: {
	watch: ['policies']
    },
    directus_permissions: {
	watch: ['permissions', 'collections', 'fields'],
	getKey: o => `${o.policy}-${o.collection}-${o.action}`
    },
    directus_access: {
	watch: ['access'],
	getKey: o => `${o.role ?? o.user ?? 'public'}-${o.policy}`
    },
    directus_settings: {
	watch: ['settings'],
	excludeFields: [
	    // always keep these 3 excluded
	    'mv_hash', 'mv_ts', 'mv_locked',
	],
    },
    directus_dashboards: {
	watch: ['dashboards']
    },
    directus_panels: {
	watch: ['panels']
    },
    directus_presets: {
	watch: ['presets'],
	getKey: (o) => `${o.role ?? 'all'}-${o.collection}-${o.bookmark || 'default'}`
    },
    directus_flows: {
	watch: ['flows']
    },
    directus_operations: {
	watch: ['operations'],
	linkedFields: ['resolve', 'reject']
    },
    directus_translations: {
	watch: ['translations'],
	getKey: (o) => `${o.key}-${o.language}`
    },
    directus_webhooks: {
	watch: ['webhooks'],
    },
    directus_collections: {
	watch: ['relations']
    },
    directus_fields: {
	watch: ['fields', 'collections'],
	getKey: (o) => `${o.collection}-${o.field}`
    },
    directus_relations: {
	watch: ['relations'],
	getKey: (o) => `${o.many_collection}-${o.many_field}`,
    }
};
