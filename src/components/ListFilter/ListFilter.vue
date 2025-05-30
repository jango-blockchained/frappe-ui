<template>
  <NestedPopover>
    <template #target>
      <Button label="Filter">
        <template #prefix><FilterIcon class="h-4" /></template>
        <template v-if="filters.size" #suffix>
          <div
            class="flex h-5 w-5 items-center justify-center rounded bg-surface-gray-7 pt-[1px] text-2xs font-medium text-ink-white"
          >
            {{ filters.size }}
          </div>
        </template>
      </Button>
    </template>
    <template #body="{ close }">
      <div
        class="my-2 rounded-lg border border-gray-100 bg-surface-white shadow-xl"
      >
        <div class="min-w-[400px] p-2">
          <div
            v-if="filters.length"
            v-for="(filter, i) in filters"
            :key="i"
            id="filter-list"
            class="mb-3 flex items-center justify-between gap-2"
          >
            <div class="flex flex-1 items-center gap-2">
              <div
                class="w-13 flex-shrink-0 pl-2 text-end text-base text-ink-gray-5"
              >
                {{ i == 0 ? 'Where' : 'And' }}
              </div>
              <div id="fieldname" class="!min-w-[140px] flex-1">
                <Autocomplete
                  :value="filter.fieldname"
                  :options="fields"
                  @change="filter.fieldname = $event.value"
                  placeholder="Filter by..."
                />
              </div>
              <div id="operator" class="!min-w-[140px] flex-shrink-0">
                <FormControl
                  type="select"
                  :modelValue="filter.operator"
                  @update:modelValue="filter.operator = $event.value"
                  :options="getOperators(filter.field.fieldtype)"
                  placeholder="Operator"
                />
              </div>
              <div id="value" class="!min-w-[140px] flex-1">
                <SearchComplete
                  v-if="
                    typeLink.includes(filter.field.fieldtype) &&
                    ['=', '!='].includes(filter.operator)
                  "
                  :doctype="filter.field.options"
                  :value="filter.value"
                  @change="filter.value = $event.value"
                  placeholder="Value"
                />
                <component
                  v-else
                  :is="
                    getValueSelector(
                      filter.field.fieldtype,
                      filter.field.options,
                    )
                  "
                  v-model="filter.value"
                  placeholder="Value"
                />
              </div>
            </div>
            <div class="flex-shrink-0">
              <Button variant="ghost" icon="x" @click="removeFilter(i)" />
            </div>
          </div>
          <div
            v-else
            class="mb-3 flex h-7 items-center px-3 text-sm text-ink-gray-5"
          >
            Empty - Choose a field to filter by
          </div>
          <div class="flex items-center justify-between gap-2">
            <Autocomplete
              value=""
              :options="fields"
              @change="(field) => addFilter(field.value)"
              placeholder="Filter by..."
            >
              <template #target="{ togglePopover }">
                <Button
                  class="!text-ink-gray-5"
                  variant="ghost"
                  @click="togglePopover()"
                  label="Add filter"
                >
                  <template #prefix>
                    <FeatherIcon name="plus" class="h-4" />
                  </template>
                </Button>
              </template>
            </Autocomplete>
            <Button
              v-if="filters.length"
              class="!text-ink-gray-5"
              variant="ghost"
              label="Clear all filter"
              @click="filters = []"
            />
          </div>
        </div>
      </div>
    </template>
  </NestedPopover>
</template>

<script setup>
import { Autocomplete, FeatherIcon, FormControl } from '../../index'
import { computed, h } from 'vue'
import FilterIcon from './FilterIcon.vue'
import NestedPopover from './NestedPopover.vue'
import SearchComplete from './SearchComplete.vue'

const typeCheck = ['Check']
const typeLink = ['Link']
const typeNumber = ['Float', 'Int']
const typeSelect = ['Select']
const typeString = [
  'Data',
  'Long Text',
  'Small Text',
  'Text Editor',
  'Text',
  'JSON',
  'Code',
]

const emits = defineEmits(['update:modelValue'])
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({}),
  },
  docfields: {
    type: Array,
    default: () => [],
  },
})

const fields = computed(() => {
  const fields = props.docfields
    .filter((field) => {
      return (
        !field.is_virtual &&
        (typeCheck.includes(field.fieldtype) ||
          typeLink.includes(field.fieldtype) ||
          typeNumber.includes(field.fieldtype) ||
          typeSelect.includes(field.fieldtype) ||
          typeString.includes(field.fieldtype))
      )
    })
    .map((field) => {
      return {
        label: field.label,
        value: field.fieldname,
        description: field.fieldtype,
        ...field,
      }
    })
  return fields
})

const filters = computed({
  get: () => makeFiltersList(props.modelValue),
  set: (value) => emits('update:modelValue', makeFiltersDict(value)),
})

function makeFiltersList(filtersDict) {
  return Object.entries(filtersDict).map(([fieldname, [operator, value]]) => {
    const field = getField(fieldname)
    return {
      fieldname,
      operator,
      value,
      field,
    }
  })
}

function getField(fieldname) {
  return fields.value.find((f) => f.fieldname === fieldname)
}

function makeFiltersDict(filtersList) {
  return filtersList.reduce((acc, filter) => {
    const { fieldname, operator, value } = filter
    acc[fieldname] = [operator, value]
    return acc
  }, {})
}

function getOperators(fieldtype) {
  let options = []
  if (typeString.includes(fieldtype) || typeLink.includes(fieldtype)) {
    options.push(
      ...[
        { label: 'Equals', value: '=' },
        { label: 'Not Equals', value: '!=' },
        { label: 'Like', value: 'like' },
        { label: 'Not Like', value: 'not like' },
      ],
    )
  }
  if (typeNumber.includes(fieldtype)) {
    options.push(
      ...[
        { label: '<', value: '<' },
        { label: '>', value: '>' },
        { label: '<=', value: '<=' },
        { label: '>=', value: '>=' },
        { label: 'Equals', value: '=' },
        { label: 'Not Equals', value: '!=' },
      ],
    )
  }
  if (typeSelect.includes(fieldtype)) {
    options.push(
      ...[
        { label: 'Equals', value: '=' },
        { label: 'Not Equals', value: '!=' },
      ],
    )
  }
  if (typeCheck.includes(fieldtype)) {
    options.push(...[{ label: 'Equals', value: '=' }])
  }
  return options
}

function getDefaultOperator(fieldtype) {
  if (
    typeSelect.includes(fieldtype) ||
    typeLink.includes(fieldtype) ||
    typeCheck.includes(fieldtype) ||
    typeNumber.includes(fieldtype)
  ) {
    return '='
  }
  return 'like'
}

function getValueSelector(fieldtype, options) {
  if (typeSelect.includes(fieldtype) || typeCheck.includes(fieldtype)) {
    const _options =
      fieldtype == 'Check' ? ['Yes', 'No'] : getSelectOptions(options)
    return h(FormControl, {
      type: 'select',
      options: _options,
    })
  } else {
    return h(FormControl, { type: 'text' })
  }
}

function getDefaultValue(field) {
  if (typeSelect.includes(field.fieldtype)) {
    return getSelectOptions(field.options)[0]
  }
  if (typeCheck.includes(field.fieldtype)) {
    return 'Yes'
  }
  return ''
}

function getSelectOptions(options) {
  return options.split('\n')
}

function addFilter(fieldname) {
  const field = getField(fieldname)
  const filter = {
    fieldname,
    operator: getDefaultOperator(field.fieldtype),
    value: getDefaultValue(field),
    field,
  }
  filters.value = [...filters.value, filter]
}

function removeFilter(index) {
  filters.value = filters.value.filter((_, i) => i !== index)
}
</script>
