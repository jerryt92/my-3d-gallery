<template>
  <table class="report-table">
    <thead>
      <tr :style="{ background: color }">
        <th>{{ title }}</th>
        <th>Message</th>
        <th>Pointer</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="msg in messages" :key="msg.pointer + msg.code">
        <td>
          <code>{{ msg.code }}</code>
        </td>
        <td>{{ msg.message }}</td>
        <td>
          <code>{{ msg.pointer }}</code>
        </td>
      </tr>
      <tr v-if="messages.length === 0">
        <td colspan="3">No issues found.</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  messages: {
    type: Array,
    required: true,
  },
});
</script>
