import { addCollection } from '@iconify/vue'
import { iconCollections } from 'virtual:yinghuo-icons'

for (const collection of iconCollections) {
  addCollection(collection)
}
