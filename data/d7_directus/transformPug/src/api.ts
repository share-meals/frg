import {defineOperationApi} from '@directus/extensions-sdk';
import {marked} from 'marked';

import pug from 'pug';

// TODO: better typing
type Options = {
  config: any;
};

export default defineOperationApi<Options>({
  id: 'operation-transform-pug',
  handler: ({config}, {data: {'$last': {data, templates}}}) => {
    const template = templates.map((t) => t.template).join('\n');
    const p = pug.compile(template);
    return p({
      ...data,
      marked
    });
  },
});
