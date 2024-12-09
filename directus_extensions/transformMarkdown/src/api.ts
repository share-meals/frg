import {defineOperationApi} from '@directus/extensions-sdk';
import * as Showdown from 'showdown';

type Options = {};

export default defineOperationApi<Options>({
  id: 'operation-transform-markdown',
  handler: ({config}, {data}) => {
    const showdown = new Showdown.Converter(config);
    return showdown.makeHtml(data['$last']);
  },
});
